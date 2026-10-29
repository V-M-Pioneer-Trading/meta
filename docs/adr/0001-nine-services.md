# Nine services, because the split is the exercise

The system is split into nine services (seven backends, the dashboard and the MCP server) because working through real service boundaries is the point of the project, not because one ship at two requests per second needs it. The accepted cost is that a change touching routing and dispatch touches two repos, and local development needs `docker compose`, which builds each backend from its sibling repo (`docker-compose.yml:6,51,79,101,123,199,240`).

Source: docs/architecture.md#Why there are nine services
