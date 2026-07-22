# Architecture

This document describes how the SpaceTraders fleet system is put together and why
it looks the way it does. It assumes no prior knowledge of the codebase. For how
the individual algorithms work, see [algorithms.md](algorithms.md); for running
and deploying the system, see [operations.md](operations.md).

## What this system is

[SpaceTraders](https://spacetraders.io/) is a programming game played entirely
through a REST API: you command a fleet of spaceships that mine asteroids, trade
goods, and fulfill contracts for credits. This project is an enterprise built on
top of that API — first as a manually-operated dashboard, then as an
increasingly autonomous operation. The end state is a single "autopilot" switch:
flip it, walk away, and the fleet keeps earning on its own.

The guiding principle throughout: **the core is deterministic, and AI sits on
top as a monitor**. Coded algorithms handle routing, pricing, and scheduling. An
AI supervisor watches health metrics and nudges parameters when things drift —
but it is never in the hot loop, and the fleet keeps running when it's down.

## System map

```mermaid
graph TD
    UI["command-interface<br/>(React, LCARS dashboard)"]
    AI["ai-service<br/>(OpenAI supervisor)"]
    AUTO["automation-service<br/>(deterministic autopilot engine)"]
    NAV["navigation-service<br/>(waypoints, markets, shipyards)"]
    AGENT["agent-service<br/>(agent, ships, contracts)"]
    FLEET["fleet-service<br/>(ship actions)"]
    GW["st-gateway<br/>(global rate budget)"]
    ST["SpaceTraders API"]
    MCP["spacetraders-mcp-server<br/>(interactive operator tools)"]

    UI --> NAV
    UI --> AGENT
    UI --> FLEET
    UI --> AUTO
    AUTO --> NAV
    AUTO --> AGENT
    AUTO --> FLEET
    AUTO -- "anomaly webhook" --> AI
    AI -- "knobs / replan / rationale" --> AUTO
    MCP --> AUTO
    NAV --> GW
    AGENT --> GW
    FLEET --> GW
    GW --> ST
```

## The services

| Service | Stack | Role |
|---|---|---|
| [navigation-service](https://github.com/V-M-Pioneer-Trading/navigation-service) | Java 21 / Spring Boot / SQLite | Read-and-cache layer for universe data: waypoints, systems, market prices, shipyards |
| [agent-service](https://github.com/V-M-Pioneer-Trading/agent-service) | Go / MySQL | Agent profile, ship list, contracts (read + accept/fulfill), contract delivery history |
| [fleet-service](https://github.com/V-M-Pioneer-Trading/fleet-service) | Node/TypeScript | All ship *actions*: orbit, dock, navigate, extract, survey, refuel, sell, deliver. Stateless |
| [st-gateway](https://github.com/V-M-Pioneer-Trading/st-gateway) | Node/TypeScript | The only door to the SpaceTraders API: one global rate budget, priority queueing, centralized retries |
| [automation-service](https://github.com/V-M-Pioneer-Trading/automation-service) | Node/TypeScript / Postgres | The deterministic autopilot engine: planner, per-ship state machines, anomaly checks, event log |
| [ai-service](https://github.com/V-M-Pioneer-Trading/ai-service) | Node/TypeScript | The AI supervisor: receives anomalies, runs a bounded OpenAI tool loop that may tune knobs or trigger replans |
| [command-interface](https://github.com/V-M-Pioneer-Trading/command-interface) | React / Vite | LCARS-themed operator dashboard: fleet map, mining controls, autopilot switch, observability panels |
| [spacetraders-mcp-server](https://github.com/V-M-Pioneer-Trading/spacetraders-mcp-server) | Node/TypeScript | MCP server exposing the same inspection/knob/replan surface to interactive clients (Claude, IDEs) |

Each repo's README covers its own API and development setup in detail.

## Service boundaries

The split follows the shape of the game itself:

- **Reads about the universe** (waypoints, markets, shipyards) live in
  navigation-service, because they benefit from caching — a waypoint's position
  never changes, so it's fetched once and kept forever; market prices get a
  short TTL instead.
- **Reads about you** (agent, ships, contracts) live in agent-service, which
  also owns the one piece of gameplay bookkeeping the game API doesn't provide:
  a history of contract deliveries.
- **Actions** (anything that moves a ship or its cargo) live in fleet-service,
  which is deliberately stateless — it translates action requests into
  SpaceTraders calls and returns the result.
- **Orchestration** (deciding what each ship should do next) lives in
  automation-service, which never calls SpaceTraders directly. It only speaks to
  the three services above, so caching and delivery history keep working no
  matter who is driving — a human at the dashboard or the autopilot.
- **Judgment** (noticing the operation has drifted and adjusting course) lives
  in ai-service, kept in a separate process so that AI failure can never take
  down the deterministic core.

## Key design decisions

### No service stores a token

There is no registration or login flow. The operator pastes an
already-obtained SpaceTraders bearer token into the UI; it lives in the
browser's `sessionStorage` and is forwarded as an `Authorization` header on
every request, all the way upstream. No backend persists it.

The one nuance is autopilot: an unattended fleet needs a token while the
operator is away, so arming the autopilot hands the token to
automation-service — which holds it **in memory only**. Nothing token-shaped is
ever written to a database, and a service restart always disarms. A dedicated
auth-service that owns credentials properly is a known future step.

### One gateway owns the rate budget

SpaceTraders allows roughly 2 requests/second per account, globally. With three
services calling the API independently, concurrent activity produced 429 errors.
st-gateway fixes this structurally: it is the only process that talks to
SpaceTraders, and it owns a single token bucket, a two-class priority queue
(interactive UI traffic beats background autopilot traffic), and all
retry/backoff handling. See [algorithms.md](algorithms.md#the-gateway-token-bucket-and-priority-queue)
for the mechanics.

### Deterministic core, AI on top

The autopilot could have been "an LLM with tools driving ships". It
deliberately isn't. automation-service is purely deterministic: a planner
scores tasks in expected credits/hour, per-ship state machines execute them,
and health checks watch for trouble — all replayable from a logged event
stream. ai-service's only levers are writing bounded configuration values
("knobs") and requesting a replan. It cannot drive a ship, and when it is down
the fleet simply continues with its current parameters. This makes AI outages
degrade to "no tuning", never "no fleet", and makes every decision auditable.

### Everything is an event

automation-service appends every lifecycle transition, planner decision, ship
action, anomaly, and AI intervention to an append-only event log in Postgres.
The log is simultaneously the audit trail ("why did ship X do that?"), the AI
supervisor's context source, and the input to metrics rollups. Planner
decisions log their full scoring inputs, so any assignment can be replayed and
debugged deterministically.

### Per-service persistence, chosen per job

Each service picks the smallest storage that fits: SQLite for
navigation-service's cache (single-writer, read-heavy), MySQL for
agent-service's delivery history, Postgres for automation-service's task
state/event log/knobs, and no database at all for fleet-service, st-gateway,
and ai-service, which are stateless by design.

### Testing: one seam per service

Every service is tested only at its outermost boundary: drive its real HTTP
API, stub its upstream dependencies with in-process HTTP servers, and assert
observable behavior — responses, downstream calls, persisted state. Planner
internals, state-machine step ordering, and queue implementations stay
swappable. automation-service's tests additionally run against a real Postgres
with an injectable clock, so multi-minute transits resolve instantly.

## The original design

The autopilot design was worked out in interview rounds before implementation;
the frozen records live in [design/autopilot-design.md](design/autopilot-design.md)
(decisions and rationale) and [design/autopilot-spec.md](design/autopilot-spec.md)
(spec with user stories). The implementation follows them closely, with small
divergences noted in the docs where they exist (e.g. route search shipped as
Dijkstra rather than BFS).

## Status and roadmap

Where things stand today:

- **Live and merged**: all seven services plus the MCP server; the full
  single-ship autopilot loop (mining, contracts, scouting), shadow mode,
  anomaly detection, metrics, knobs, the AI supervisor, and the dashboard
  panels.
- **Built but not yet applied**: production Terraform (see
  [operations.md](operations.md#production-deployment)).
- **Known single-ship scope**: the planner and replan machinery are written to
  scale to N ships, but dispatch is still keyed to one configured mining ship.
  Fleet expansion (auto-purchasing ships) is the first v2 item, followed by
  trade arbitrage and multi-system operations.

See the [meta issue tracker](https://github.com/V-M-Pioneer-Trading/meta/issues)
for the full list.
