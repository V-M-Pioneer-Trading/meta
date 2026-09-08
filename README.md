# SpaceTraders — meta

Project-wide documentation and local-dev orchestration for an increasingly
autonomous [SpaceTraders](https://spacetraders.io/) fleet: a deterministic
autopilot core (planner, per-ship state machines, anomaly detection) with an
AI supervisor on top that tunes parameters but never drives ships.
Cross-cutting issues that don't belong to a single service also live here.

## Documentation

Start with [the decision model on one page](docs/algorithms.md#the-decision-model-on-one-page)
— it's the shortest path to understanding what this thing actually does.

- **[Algorithms](docs/algorithms.md)** — how the autopilot thinks: the scoring
  model and a worked example, where its numbers come from, what it deliberately
  doesn't capture, the work loops, anomaly detection, replay, the AI
  supervisor, the rate-limit gateway
- **[Architecture](docs/architecture.md)** — system map, the services and
  their boundaries, why there are eight of them, key design decisions, status
- **[Operations](docs/operations.md)** — running locally, production
  deployment, CI, testing philosophy
- **[Original design records](docs/design/)** — the frozen pre-implementation
  autopilot design and spec, and the
  [authentication design](docs/design/auth-design.md) covering Clerk identity
  and the credential-owning auth-service
- **[Upstream errors](docs/design/upstream-errors.md)** — what a service
  answers when st-gateway does not, and the conformance fixtures every client
  of it is tested against

## Services

| Repo | Language | Owns |
|------|----------|------|
| [navigation-service](https://github.com/V-M-Pioneer-Trading/navigation-service) | Java / Spring Boot | Waypoints, systems, market, shipyard (read + cache) |
| [agent-service](https://github.com/V-M-Pioneer-Trading/agent-service) | Go | Agent profile, ships, contracts, delivery history |
| [fleet-service](https://github.com/V-M-Pioneer-Trading/fleet-service) | Node/TS | Ship actions (orbit, dock, navigate, extract, sell, …) |
| [st-gateway](https://github.com/V-M-Pioneer-Trading/st-gateway) | Node/TS | Global SpaceTraders rate budget, priority queueing, retries |
| [automation-service](https://github.com/V-M-Pioneer-Trading/automation-service) | Node/TS | Deterministic autopilot engine: planner, FSMs, anomalies, event log |
| [ai-service](https://github.com/V-M-Pioneer-Trading/ai-service) | Node/TS | AI supervisor: bounded knob tuning + replan triggers |
| [command-interface](https://github.com/V-M-Pioneer-Trading/command-interface) | React | LCARS-themed operator dashboard |
| [spacetraders-mcp-server](https://github.com/V-M-Pioneer-Trading/spacetraders-mcp-server) | Node/TS | MCP tools for interactive operators (Claude, IDEs) |

## Quickstart

With all repos checked out as siblings, from `meta/`:

```bash
docker compose up --build
```

then `npm run dev` in `command-interface/`. Full instructions, ports, and the
services not yet in compose: [docs/operations.md](docs/operations.md).
