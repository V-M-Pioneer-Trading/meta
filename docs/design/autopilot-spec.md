# Spec: Autopilot Mode

*Synthesized from autopilot-design.md and design interviews, 2026-07-17. Triage: `ready-for-agent`. Suggested tracker home: `V-M-Pioneer-Trading/meta` (cross-cutting).*

*Editorial correction, 2026-09-10: this record had the operator arming autopilot by pasting the **account** token — in Solution below, and in user story 2. By the glossary in [CONTEXT.md](../../CONTEXT.md) the account token only registers a new agent after a universe reset and cannot drive a ship; the credential meant was the **agent** token, and the term is corrected in both places. Nothing else in this record is rewritten — the paste-to-arm flow it describes was itself superseded by [auth-design.md](auth-design.md) decision 5, which took the game token out of the browser entirely.*

## Problem Statement

Running the SpaceTraders enterprise today requires constant manual attention. Every mining run, contract delivery, refuel, and market sale is triggered by hand through the command-interface UI. The operator cannot step away: ships sit idle the moment a task completes, contracts expire unevaluated, and market knowledge goes stale. On top of that, the three backend services call the SpaceTraders API independently with no shared rate limiting, so any concurrent activity risks 429 errors (meta issue #1).

The operator wants to flip one switch and trust that the enterprise keeps running profitably on its own — without handing the controls entirely to an AI, since most operations are automatable with deterministic algorithms.

## Solution

An autopilot mode built on a deterministic core with an AI supervisor on top.

A new automation-service runs a central planner that continuously assigns each ship the most profitable task (mining, contract work, or market scouting) using deterministic scoring — expected credits per hour, BFS-based route costs, cached market prices. Each ship executes its task as a resumable state machine. All game actions flow through the existing navigation/agent/fleet services, which in turn route every SpaceTraders call through a new st-gateway that owns the global rate budget with priority queueing.

A separate ai-service watches the operation: deterministic health checks in automation-service raise anomaly events (webhook + hourly digest pull), and the ai-service runs an OpenAI-backed tool loop that may adjust bounded planner parameters and trigger replans — never drive ships directly. A new MCP server exposes the same control surface to interactive clients.

The operator arms autopilot by pasting the agent token in the UI, watches a bridge-view dashboard, and can pause or abort at any time.

## User Stories

1. As a fleet operator, I want a single autopilot on/off switch in the UI, so that my enterprise runs unattended once I turn it on.
2. As a fleet operator, I want to arm autopilot by pasting my agent token (held in memory only), so that no service persists my credentials.
3. As a fleet operator, I want a pause mode that lets ships finish their current step before idling, so that I can halt operations without stranding cargo mid-task.
4. As a fleet operator, I want an abort mode that stops all dispatching immediately, so that I have a hard kill switch when something goes wrong.
5. As a fleet operator, I want the mining loop automated end-to-end (travel, survey, extract, refuel, sell at the best nearby market), so that mining income continues without my input.
6. As a fleet operator, I want contracts evaluated for profitability deterministically before acceptance, so that autopilot never signs a losing contract.
7. As a fleet operator, I want accepted contracts procured, delivered, and fulfilled automatically, so that contract income and reputation grow on their own.
8. As a fleet operator, I want ships to refresh market price data into the navigation cache, so that the planner never decides on stale intel.
9. As a fleet operator, I want a central planner that assigns each ship the highest-scoring task in comparable units (expected credits per hour), so that the fleet as a whole maximizes profit rather than each ship acting selfishly.
10. As a fleet operator, I want route and travel-time costs computed with fuel-aware BFS over the system's waypoint graph, so that task scores reflect real travel expense.
11. As a fleet operator, I want ships reassigned immediately when they finish or fail a task, so that no ship idles waiting for a scheduler tick.
12. As a fleet operator, I want a periodic full-fleet replan (debounced), so that cross-ship rebalancing happens when prices or goals drift.
13. As a fleet operator, I want running tasks never preempted by replans, so that ship behavior stays predictable and no cargo is stranded half-sold.
14. As a fleet operator, I want per-ship task state persisted, so that autopilot resumes cleanly after a service restart (once re-armed with the token).
15. As a fleet operator, I want a configurable credit reserve floor the planner may never breach, so that a bug cannot bankrupt me into fuel starvation.
16. As a fleet operator, I want every autopilot decision recorded in an append-only event log, so that I can audit why any ship did what it did.
17. As a fleet operator, I want profitability metrics (credits/hour, yields, error rates) rolled up and stored, so that I can judge whether autopilot is actually performing.
18. As a fleet operator, I want deterministic health checks (idle ship, profit drop, repeated failures, API error rate, stagnant credits, stale intel) raising anomaly events, so that problems are detected without AI in the loop.
19. As a fleet operator, I want anomalies pushed to the AI supervisor promptly and also swept up by an hourly review, so that no incident is silently lost.
20. As a fleet operator, I want the AI supervisor limited to adjusting schema-bounded parameters and triggering replans, so that an AI failure or bad suggestion can never crash the enterprise.
21. As a fleet operator, I want every AI adjustment logged with a written rationale, so that I can review and learn from its interventions.
22. As a fleet operator, I want the fleet to keep operating on current parameters when the AI supervisor is down or erroring, so that autopilot never depends on AI availability.
23. As a fleet operator, I want a dashboard showing each ship's current task and state, so that I can glance and trust rather than inspect.
24. As a fleet operator, I want a credits-per-hour graph and event/decision feed in the UI, so that I can see trend and causes together.
25. As a fleet operator, I want an anomaly and AI-action log in the UI, so that supervisor activity is transparent.
26. As a fleet operator, I want a knob editor in the UI with validated bounds, so that I can hand-tune the same parameters the AI tunes.
27. As a fleet operator, I want UI requests prioritized over autopilot background traffic at the gateway, so that the interface stays responsive while autopilot saturates the rate budget.
28. As a fleet operator, I want all services sharing one global SpaceTraders rate budget with central retry/backoff and 429 handling, so that concurrent operation stops producing rate-limit errors.
29. As an AI supervisor, I want tools to read metrics, anomalies, the event log, and current knobs, so that I can diagnose drift with full context.
30. As an AI supervisor, I want tools to set knob values within declared bounds and to trigger a fleet replan, so that I can correct course within safe limits.
31. As an interactive operator (Claude chat / IDE), I want an MCP server exposing the same inspection and knob/replan tools, so that I can debug and steer the live system conversationally.
32. As a developer, I want gateway queue depth and latency observable, so that I can tell when the rate budget is the bottleneck.
33. As a developer, I want the planner's scoring reproducible from logged inputs, so that any decision can be replayed and debugged deterministically.
34. As a developer, I want existing services to remain the only SpaceTraders API surface, so that caching and delivery history keep working and client code is not duplicated.

## Implementation Decisions

- Four new TypeScript services/repos: **st-gateway** (global ST request queue: token-bucket rate limit ~2 req/s, priority classes interactive > background, centralized retry/backoff and 429 handling), **automation-service** (purely deterministic engine), **ai-service** (all AI integration), and a new **MCP server** based on the existing spacetraders-mcp-server but targeting our own system's APIs. A later **auth-service** will eventually own credentials.
- navigation-service, agent-service, and fleet-service keep their current roles and remain the sole ST API surface; they are modified only to route outbound ST calls through st-gateway and to add small endpoints as autopilot needs grow. automation-service never calls SpaceTraders directly.
- Engine model: central planner + per-ship finite state machines. Planner scores every candidate task as expected profit ÷ expected time (BFS route cost, cached prices), weighted per task type; scouting valued via intel-freshness decay. Weights and thresholds are the configurable "knobs".
- Planner timing: event-driven single-ship assignment on task completion/failure; full-fleet replan on knob change, anomaly, or ~5-minute interval, debounced to ≥30 s. No preemption — tasks are short and bounded; abort is the only interrupt.
- v1 loops: mining, contracts, market intel/scouting. (Expansion, arbitrage, multi-system are v2 — see Out of Scope.)
- Persistence: one Postgres database for automation-service — plan and task assignments, per-ship FSM state, knob table (value + default + min/max), append-only event/decision log, metric rollups.
- Anomaly detection: six deterministic checks, each an AI-tunable bounded knob — ship idle >10 min; fleet profit/hour <50% of 6 h rolling average; ≥3 consecutive task failures on one ship; ST error rate >10% over 5 min; credits net-flat over 2 h; market intel staleness over threshold for markets in active use. *(Shipped as five: the profit-collapse and net-flat-credits checks merged into one `earnings_stalled`, both conditions still separately tunable.)*
- Anomaly transport: automation-service persists the anomaly, then POSTs a webhook to ai-service with retry/backoff and a dedupe key; ai-service also pulls an event-log digest on an hourly scheduled review. No message broker.
- AI runner: ai-service composes context (anomaly, recent events, current knobs) and runs a short OpenAI-API tool-use loop ending in bounded knob writes and/or a replan trigger, plus a rationale appended to the event log. The deterministic core is authoritative; AI outages degrade to "no tuning", never "no fleet".
- Auth: token pasted in the UI to arm autopilot, held in memory by automation-service and forwarded as Bearer downstream; restart disarms. Existing pass-through auth unchanged.
- Safety rails: kill switch (pause = finish current FSM step then idle; abort = stop immediately), credit reserve floor enforced by the planner, schema-validated min/max on every AI-adjustable knob.
- UI: command-interface gains the autopilot switch with paste-to-arm flow, per-ship task/state view, credits/hour graph, event/decision feed, anomaly + AI-action log, and knob editor.
- Build order: st-gateway → automation-service (mining FSM first, then planner + contracts + scouting) → UI → ai-service + MCP repo.

## Testing Decisions

- Tests assert external behavior only, never internals: given requests at a service's own HTTP boundary and controlled responses from its stubbed dependencies, the observable outputs (responses, downstream calls made, persisted state via API) must match — planner internals, FSM step ordering, and queue implementation stay swappable.
- One seam per service, at the highest boundary (confirmed decision):
  - **st-gateway** — drive through its proxy API with an in-process fake SpaceTraders API; assert global budget enforcement, priority ordering, retry/backoff, and 429 behavior. No internal seams.
  - **automation-service** — drive through its REST API with stub HTTP servers standing in for navigation/agent/fleet services (and the gateway path they imply), plus controllable clock; assert task assignment, FSM progression, safety-rail enforcement, anomaly emission, and event-log contents through the API. Planner scoring is exercised at this same seam via scenario fixtures (fleet + market + contract states with expected assignments).
  - **ai-service** — drive through its anomaly webhook endpoint with a stub automation-service API and stub OpenAI API; assert bounded knob writes, replan triggers, dedupe behavior, and rationale logging.
- Prior art: fleet-service's jest suite (service tested over HTTP with mocked upstream) and the spacetraders-mcp-server test setup; new services follow the same jest + supertest-style pattern.

## Out of Scope

- v2 roadmap items, in agreed priority order: fleet expansion (auto ship purchase and role assignment), trade arbitrage routes, multi-system operations (jump gates, BFS over the systems graph).
- auth-service and any persisted credential storage; paste-to-arm is the v1 answer.
- Task preemption (graceful or hard); replans only touch idle/completing ships.
- A message broker for anomaly transport; webhook + hourly pull is the v1 answer.
- Claude/Anthropic-based runner for ai-service; OpenAI API is the chosen provider for v1 (the MCP server keeps the door open for other clients).
- Ship actions outside the three v1 loops (siphon, jettison, jump, warp, scanning, mounts/modules, repair, scrap, ship purchase).
- Multi-account / multi-agent support.

## Further Notes

- st-gateway closes long-standing meta issue #1 (rate limiting) and is valuable standalone — it should land and be adopted by all three existing services before autopilot traffic exists.
- Shadow/dry-run mode (planner logs decisions without executing) was deliberately left out of v1 must-haves but is cheap given the plan/execute split and strongly recommended before the first unattended live run.
- Knob writes are last-writer-wins between the UI editor and ai-service; the event log provides the audit trail. Acceptable for v1; revisit if contention appears.
- The event log doubles as AI context: rollups plus recent events should be readable through one endpoint designed with the AI's context window in mind.
- Repo naming for the new MCP server is TBD; it supersedes the dispatch engine in spacetraders-mcp-server, whose repo remains as reference.
