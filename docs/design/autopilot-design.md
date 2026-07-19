# Autopilot Mode — Design Decisions

*Outcome of design interviews (rounds 1–2), 2026-07-17. Status: agreed direction, pre-implementation.*

## Vision

A single "autopilot" switch. When on, the enterprise (fleet, contracts, trading) runs unattended. The core is **deterministic** — coded algorithms handle routing (BFS), price analysis, task scheduling. **AI sits on top as a monitor**: it watches health metrics, and when the situation drifts, it adjusts the automation plan. AI is never in the hot loop and never required for the fleet to keep running.

```
                 ┌──────────────────────────────┐
                 │  ai-service (TS)             │
                 │  OpenAI-backed monitor:      │
                 │  anomaly webhook + hourly    │
                 │  pull → tune knobs, replan   │
                 └────────────┬─────────────────┘
                              │ knobs / replan API
                              ▼                    ▲ anomaly webhook
┌──────────────┐   ┌──────────────────────────────┐
│ command-     │──►│ automation-service (TS)      │
│ interface    │   │  purely deterministic:       │
│  switch +    │   │  planner + per-ship FSMs,    │
│  dashboard   │   │  health checks, Postgres     │
└──────────────┘   └────────────┬─────────────────┘
                                │ tasks → actions
                                ▼
              ┌─────────────────────────────────────┐
              │ navigation / agent / fleet services  │
              │ (unchanged roles: reads + actions)   │
              └────────────────┬────────────────────┘
                               ▼
              ┌─────────────────────────────────────┐
              │ st-gateway (TS): global queue,      │
              │ rate limit, retry/backoff, priority │
              └────────────────┬────────────────────┘
                               ▼
                      SpaceTraders API
```

## Decisions

### 1. New `automation-service` owns the deterministic engine

A dedicated service (new repo) holds the planner, per-ship state machines, and all deterministic algorithms (BFS routing, price/profitability analysis). Existing services stay dumb executors. Rejected: growing the MCP server's dispatch engine into the autopilot (couples AI interface with the engine, bypasses our microservices), and distributing loops across existing services (orchestration smeared over three codebases).

### 2. Actions flow through existing services

automation-service calls navigation-service, agent-service, and fleet-service — never SpaceTraders directly. They remain the single ST API surface; the nav cache and delivery history keep working. Existing services will need small API additions as autopilot needs grow (e.g. purchase-ship later).

### 3. Rate limiting: standalone gateway/queue component (`st-gateway`)

ST allows ~2 req/s per account, globally. Today three services call ST independently (meta issue #1). Decision: a standalone queue/proxy component owns the global budget. All services route outbound ST calls through it. One implementation, one token bucket, request priorities (interactive UI > autopilot background), centralized retry/backoff and 429 handling.

### 4. Token: paste-to-arm now, auth-service later

For now the user pastes the token into the UI to arm autopilot; automation-service holds it **in memory only** — no persisted secret. Known trade-off: a service restart disarms autopilot and requires re-arming. Eventually a dedicated **auth-service** will own credentials properly. Existing services stay pass-through (Bearer forwarded per request), unchanged.

### 5. V1 loops: mining, contracts, market intel

- **Mining loop** — travel → survey → extract → refuel → sell at best nearby market. POC-proven, first to automate end-to-end.
- **Contract loop** — deterministic profitability evaluation → accept → procure/mine → deliver → fulfill.
- **Market intel / scouting** — ships refresh market prices into the navigation-service cache; without fresh data the other loops decide blind.

Deferred to v2: trade arbitrage routes and fleet expansion (auto-purchase ships, role assignment).

### 6. Engine model: central planner + per-ship FSMs

A planner runs over fleet state, contracts, and market intel, and assigns each ship a task. Each ship executes its task as a deterministic, resumable state machine (dock → refuel → navigate → extract → …). Fleet-level goals need the central view; FSMs are debuggable and survive restarts (state persisted, see §9).

**Timing: event-driven + periodic full replan.** When a ship finishes or fails a task, the planner immediately scores and assigns that ship's next task (cheap, single-ship). A full fleet replan runs on knob change, on anomaly, and every ~5 minutes — debounced to ≥30s apart so knob storms don't thrash.

**No preemption.** Running FSMs always finish; replans only reassign idle/completing ships. Tasks are kept short and bounded (one mining round-trip, one delivery leg) so a "wrong" assignment costs minutes. The kill switch abort is the only interrupt.

### 7. Planner objective: scored expected credits/hour with tunable weights

Every candidate task gets a deterministic score: expected profit ÷ expected time (travel cost via BFS route, prices from intel cache), multiplied by a configurable weight per task type. Scouting receives synthetic value via intel-freshness decay. One comparable currency for all decisions — and the weights are exactly the knobs the AI tunes.

### 8. AI monitor: separate `ai-service`, config knobs + replan triggers only

**Service split:** automation-service stays *purely deterministic* — planner, FSMs, health checks. All AI integration lives in a dedicated **`ai-service`** (TS). The MCP server is a third, separate repo.

The AI may adjust planner parameters (weights, market blacklists, role mix, loop on/off) through the automation-service API and force a replan. It never drives ships directly — the deterministic core stays authoritative; AI failure cannot crash the enterprise.

**Cadence + event path: event-driven + hourly review.** automation-service runs cheap deterministic health checks and, when one fires, persists the anomaly to Postgres and POSTs a webhook to ai-service (retry with backoff, dedupe key). ai-service additionally pulls an event-log digest on an ~hourly scheduled review — this also catches any missed webhook. No message broker; anomaly volume doesn't justify one.

**Anomaly checks v1** (each a bounded, AI-tunable knob with default/min/max):

1. Ship idle > 10 min
2. Fleet profit/hour < 50% of 6h rolling average
3. ≥3 consecutive task failures on one ship
4. ST error rate > 10% over 5 min
5. Credits net-flat over 2h
6. Market intel staleness above threshold for markets in active use

**Runner: ai-service calls the OpenAI API.** On anomaly/review, ai-service composes context (anomaly + recent event log + current knobs) and runs a short OpenAI-backed tool-use loop, ending with knob adjustments/replan trigger and a written rationale appended to the event log.

**MCP repo:** the current `spacetraders-mcp-server` (talks to ST API directly) becomes the foundation for a new repository: an MCP server targeting *our* system — automation-service metrics/anomalies/knobs/replan plus other internal APIs. Used by interactive MCP clients (Claude, IDEs) and available as a tool source for ai-service. The old server's dispatch engine is superseded by the planner.

### 9. Persistence: Postgres with a full event log

One Postgres DB for automation-service: plan + task assignments, per-ship FSM state (restart resume), config knobs, an append-only event/decision log, and metric rollups (credits/hour, yield, error rates). The event log doubles as the AI monitor's context and as the audit trail of every autopilot decision.

### 10. Safety rails (v1 must-haves)

- **Kill switch** — UI toggle + API endpoint. Pause = finish current FSM step then idle; abort = stop dispatching immediately. This is the autopilot switch's off position.
- **Credit reserve floor** — the planner never lets projected credits fall below a configurable floor (fuel money). Prevents the classic ST fuel-starvation death spiral.
- **Bounded AI knobs** — every AI-adjustable parameter has schema-validated min/max. The AI can tune, never break.

Considered, not required for v1: shadow/dry-run mode (cheap to add later since plan and execute are split; still recommended before first live run).

### 11. UI: autopilot switch + ops dashboard

command-interface gets: on/off/pause toggle (with token paste-to-arm flow), per-ship current task + FSM state, credits/hour graph, event/decision feed, anomaly + AI-action log, and a knob editor. The "bridge view" — glance, trust, walk away.

### 12. Stack: new services in TypeScript

automation-service, ai-service, and st-gateway in TS/Node. Reuses ST types and client code from fleet-service and the MCP server; gateway is a tiny IO-bound proxy where Node fits; one toolchain across the new services.

## New repositories

| Repo | Purpose |
|------|---------|
| `st-gateway` | Global ST request queue: rate limit, priorities, retry/backoff |
| `automation-service` | Purely deterministic: planner, per-ship FSMs, health checks, knobs API, Postgres |
| `ai-service` | AI integrations: anomaly webhook receiver, hourly review, OpenAI runner |
| new MCP server (name TBD) | Toolset against our system for MCP clients + ai-service; based on `spacetraders-mcp-server` |
| `auth-service` (later) | Credential ownership, replaces paste-to-arm |

## Build order

1. **st-gateway** — build queue, route nav/agent/fleet services through it. Closes meta issue #1; unblocks everything else.
2. **automation-service** — mining-loop FSM first, then planner + contract loop + scouting. Validate in shadow mode before going live.
3. **UI** — autopilot switch (paste-to-arm) + ops dashboard in command-interface.
4. **AI layer** — new MCP repo + ai-service (webhook receiver, hourly review, OpenAI runner).

Each phase is independently useful; AI arrives once there is something to watch.

## V2 roadmap (ordered, no dates)

1. **Fleet expansion** — auto-buy ships when credits allow; compounding effect multiplies every other loop.
2. **Trade arbitrage** — buy-low/sell-high routes; needs richer intel plus the hauler ships expansion provides.
3. **Multi-system operations** — jump gates, BFS over the systems graph; biggest scope, needs everything else stable.
