# Repo map: meta

Tickets repo and project-wide docs for the SpaceTraders fleet, plus local-dev orchestration. No `package.json`; scripts are plain Node.

| Path | Holds |
|---|---|
| `README.md` | doc index, service table, quickstart |
| `GLOSSARY.md`, `GLOSSARY-MAP.md` | workspace vocabulary, per-repo glossaries |
| `docs/algorithms.md` | decision model, scoring, work loops, anomalies, replay, AI supervisor, rate-limit gateway |
| `docs/architecture.md` | system map, service boundaries, status |
| `docs/operations.md` | local run, production deploy, CI, testing |
| `docs/design/auth-design.md` | identity and credentials; decisions 1–23 |
| `docs/design/autopilot-design.md`, `autopilot-spec.md` | frozen autopilot design (decisions 1–13) and spec |
| `docs/design/token-introspection.md`, `upstream-errors.md` | written contracts behind the fixtures |
| `fixtures/` | `gateway-errors.json`, `introspection.json` (vendored by six repos) |
| `openapi/` | bot-written OpenAPI 3 copies of each service's spec |
| `scripts/` | `validate-fixtures.mjs`, `validate-openapi.mjs`, `mint-dev-token.mjs` |
| `dev-keys/` | committed local-only keypair (see its README) |
| `docker-compose.yml` | st-gateway, mysql, agent, navigation, fleet, auth, automation-postgres, automation, ai-service, built from sibling dirs |
| `docs/agents/heinzelwerk/` | agent team docs: workspace map, learnings |

- CI `validate.yml` (PR, push main): fixtures and OpenAPI validation; restricts `openapi-sync/*` PRs to their own file.
- `openapi-sync.yml`: reusable workflow backends call on push to main; opens an auto-merging PR as App `vmpt-openapi-sync`.
