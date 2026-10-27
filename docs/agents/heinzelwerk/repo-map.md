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

## Reference docs

- `docs/algorithms.md`: read when tuning a knob, changing scoring, or explaining why a ship did what it did.
- `docs/architecture.md`: read when deciding which service a new feature belongs in ("Service boundaries", "Why there are nine services").
- `docs/operations.md`: read when running the stack locally, editing a workflow, debugging a deploy, or when auth-service is down.
- `docs/design/auth-design.md`: read before changing tokens, scopes, M2M minting, verification or universe-reset handling; its numbered decisions are ADRs.
- `docs/design/autopilot-design.md`: read before changing the engine's shape; numbered decisions are ADRs. `autopilot-spec.md` is the frozen v1 scope, not a source of rules.
- `docs/design/token-introspection.md`: read when touching a verifier's 401/403/500/503 mapping, bearer parsing, M2M callers, or re-vendoring `fixtures/introspection.json`.
- `docs/design/upstream-errors.md`: read when adding a client error path or changing what st-gateway answers.
- `openapi/README.md`: read when editing `openapi/*.json` or adding a service to the sync.
- `dev-keys/README.md`: read when minting a local token or driving services without Clerk.
- `docs/adr/`: workspace ADRs beyond the design-doc decisions.
