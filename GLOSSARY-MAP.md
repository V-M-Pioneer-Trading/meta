# Glossary map

Each repo in the workspace is one context. Workspace-wide terms live in [GLOSSARY.md](GLOSSARY.md); a repo's own `GLOSSARY.md` holds terms that mean something only inside it, and is created the first time one is needed.

| Context | Glossary | Covers |
|---|---|---|
| workspace | [GLOSSARY.md](GLOSSARY.md) | identity and credentials (operator, machine, visitor, scope, game token, account token, the center, introspection, `kind`), traffic (live fetch, refresh, lane) |
| automation-service | `automation-service/GLOSSARY.md` (not yet) | autopilot, planner, task FSMs, shadow / live, knobs, anomalies, event log |
| ai-service | `ai-service/GLOSSARY.md` (not yet) | supervisor, policy knobs, digest |
| auth-service | `auth-service/GLOSSARY.md` (not yet) | vault, center, M2M minting, reset detection |
| st-gateway | `st-gateway/GLOSSARY.md` (not yet) | rate budget, lanes, retries |
| agent-service, fleet-service, navigation-service | their own `GLOSSARY.md` (not yet) | agent, ships, contracts, deliveries; ship actions; waypoints, markets, shipyards |
| command-interface | `command-interface/GLOSSARY.md` (not yet) | panels, LCARS UI terms |

## How the contexts relate

- auth-service defines the identity terms every other context uses; they stay in the workspace glossary.
- automation-service is the producer of autopilot terms (events, anomalies, knobs); ai-service, command-interface and spacetraders-mcp-server consume them unchanged.
- Decisions behind the terms: `docs/design/auth-design.md` (1–23), `docs/design/autopilot-design.md` (1–13); new workspace-wide ADRs in `docs/adr/`.
