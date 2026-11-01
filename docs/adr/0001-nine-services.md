# Nine services, because the split is the exercise

The system is split into nine services (seven backends, the dashboard and the MCP server) because working through real service boundaries is the point of the project, not because one ship at two requests per second needs it. The accepted cost is that a change touching routing and dispatch touches two repos, and local development needs `docker compose`, which builds each backend from its sibling repo (`docker-compose.yml:6,51,79,101,123,199,240`).

## Considered Options

1. One process, probably a single file: comfortably enough for one ship mining one system at two requests per second. Lost because service boundaries, a shared global rate budget, per-service persistence choices and an AI component fenced off from the deterministic core are the problems worth practising on, and they are only real when the boundaries are real.
2. **Nine services (chosen)**: seven backends counting the rate gateway and the credential holder, plus the dashboard and the MCP server.

Source: docs/architecture.md#Why there are nine services
