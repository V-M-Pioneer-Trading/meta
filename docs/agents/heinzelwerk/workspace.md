# Workspace

This repo is the **tickets repo** of a multi-repo workspace. Mode rules live in the `heinzelwerk:team-modes` skill.

- **Tickets**: V-M-Pioneer-Trading/meta
- **Workspace root**: `C:\Users\max\work\spacetraders`, every repo checked out as a sibling directory
- **Integration**: none yet. `docker compose up --build` from `meta/` starts the backends, but no smoke script exercises them

## Repos

| Dir | GitHub | Role (owner) | Checks |
|---|---|---|---|
| agent-service | V-M-Pioneer-Trading/agent-service | backend | see `agent-service/docs/agents/heinzelwerk/team.md` |
| auth-service | V-M-Pioneer-Trading/auth-service | backend | see `auth-service/docs/agents/heinzelwerk/team.md` |
| automation-service | V-M-Pioneer-Trading/automation-service | backend | see `automation-service/docs/agents/heinzelwerk/team.md` |
| ai-service | V-M-Pioneer-Trading/ai-service | backend | see `ai-service/docs/agents/heinzelwerk/team.md` |
| fleet-service | V-M-Pioneer-Trading/fleet-service | backend | see `fleet-service/docs/agents/heinzelwerk/team.md` |
| navigation-service | V-M-Pioneer-Trading/navigation-service | backend | see `navigation-service/docs/agents/heinzelwerk/team.md` |
| st-gateway | V-M-Pioneer-Trading/st-gateway | backend | see `st-gateway/docs/agents/heinzelwerk/team.md` |
| spacetraders-mcp-server | V-M-Pioneer-Trading/spacetraders-mcp-server | backend | see `spacetraders-mcp-server/docs/agents/heinzelwerk/team.md` |
| command-interface | V-M-Pioneer-Trading/command-interface | frontend | see `command-interface/docs/agents/heinzelwerk/team.md` |
| eslint-config | V-M-Pioneer-Trading/eslint-config | backend (shared package) | see `eslint-config/docs/agents/heinzelwerk/team.md` |
| ts-introspection-client | V-M-Pioneer-Trading/clerk-client | backend (shared package) | see `ts-introspection-client/docs/agents/heinzelwerk/team.md` |
| V-M-Pioneer-Trading_infrastructure | V-M-Pioneer-Trading/infrastructure | infra | see `V-M-Pioneer-Trading_infrastructure/docs/agents/heinzelwerk/team.md` |
| meta | V-M-Pioneer-Trading/meta | backend (docs, fixtures, compose) | see `meta/docs/agents/heinzelwerk/team.md` |

`spacetraders-api-docs` is the upstream SpaceTradersAPI/api-docs checkout: read it for the game API, never edit it.

## Who calls whom

- command-interface → agent-service, navigation-service, fleet-service, automation-service: HTTP with the operator's Clerk bearer, through CloudFront paths; contracts at each provider's `openapi.json` (automation-service: no spec, routes in its `CLAUDE.md`)
- automation-service → agent-service, fleet-service, navigation-service: HTTP with an M2M bearer from auth-service
- automation-service → ai-service: anomaly webhook `POST /webhooks/anomaly` (`generic` format; `telegram` pages a chat instead); ai-service → automation-service: knobs (policy class only), digest, replan, events
- spacetraders-mcp-server → automation-service (knobs, replan, metrics) and SpaceTraders directly
- agent-service, fleet-service, navigation-service, auth-service → st-gateway `/proxy/<SpaceTraders path>`; st-gateway → SpaceTraders, injecting the agent token it fetches from auth-service `GET /auth/v1/token`
- fleet-service → agent-service `POST /contracts/{id}/deliveries`
- every verifier (agent, fleet, navigation, automation, st-gateway) → auth-service `POST /auth/v1/introspect`; contract `meta/docs/design/token-introspection.md` + `meta/fixtures/introspection.json`
- automation-service, ai-service → auth-service `POST /auth/v1/m2m-token`
- TS services → `@v-m-pioneer-trading/clerk-client` and `@v-m-pioneer-trading/eslint-config`: release tarballs pinned by URL
- every service's CI → V-M-Pioneer-Trading_infrastructure's SSM bootstrap document on push to main; backend CI → meta's reusable `openapi-sync.yml`

## Cross-repo traps

- Push to main deploys production in every service repo (SSM redeploy, or S3 sync for command-interface). Infra is applied by hand.
- A shared-package change lands in three steps: provider PR, release tag, then one bump PR per consumer.
- A fixture change goes to `meta/fixtures/` first; vendored copies are byte-identical (st-gateway pins the sha256).
- `meta/openapi/*.json` are bot-written copies; edit the service's own `openapi.json`.
- auth-service's two secrets (`AUTH_SERVICE_SHARED_SECRET`, `AUTH_INTROSPECTION_SECRET`) must differ; st-gateway crash-loops without either.
- An infra PR that adds an SSM document parameter is applied before the service CI change that passes it, or SSM rejects the deploy.
- Ports: command-interface defaults `VITE_NAVIGATION_SERVICE_URL` to :8081, navigation-service listens on :8080.
