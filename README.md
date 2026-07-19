# SpaceTraders — meta

Project-wide documentation and local-dev orchestration for an increasingly
autonomous [SpaceTraders](https://spacetraders.io/) fleet: a deterministic
autopilot core (planner, per-ship state machines, anomaly detection) with an
AI supervisor on top that tunes parameters but never drives ships.
Cross-cutting issues that don't belong to a single service also live here.

## Documentation

- **[Architecture](docs/architecture.md)** — system map, the services and
  their boundaries, key design decisions, status and roadmap
- **[Algorithms](docs/algorithms.md)** — how the autopilot thinks: planner
  scoring, routing, the mining/contract/scouting loops, anomaly detection,
  the AI supervisor, the rate-limit gateway
- **[Operations](docs/operations.md)** — running locally, production
  deployment, CI, testing philosophy
- **[Original design records](docs/design/)** — the frozen pre-implementation
  autopilot design and spec

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
