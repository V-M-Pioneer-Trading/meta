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
| spacetraders-mcp-server | V-M-Pioneer-Trading/spacetraders-mcp-server | backend (not in active development) | see `spacetraders-mcp-server/docs/agents/heinzelwerk/team.md` |
| command-interface | V-M-Pioneer-Trading/command-interface | frontend | see `command-interface/docs/agents/heinzelwerk/team.md` |
| eslint-config | V-M-Pioneer-Trading/eslint-config | backend (shared package) | see `eslint-config/docs/agents/heinzelwerk/team.md` |
| ts-introspection-client | V-M-Pioneer-Trading/clerk-client | backend (shared package) | see `ts-introspection-client/docs/agents/heinzelwerk/team.md` |
| V-M-Pioneer-Trading_infrastructure | V-M-Pioneer-Trading/infrastructure | infra | see `V-M-Pioneer-Trading_infrastructure/docs/agents/heinzelwerk/team.md` |
| meta | V-M-Pioneer-Trading/meta | backend (docs, fixtures, compose) | see `meta/docs/agents/heinzelwerk/team.md` |

spacetraders-mcp-server is not in active development and none is planned: take no ticket there unless the ticket names it.

`spacetraders-api-docs` is the upstream SpaceTradersAPI/api-docs checkout: read it for the game API, never edit it.

## Who calls whom

- command-interface → agent-service, navigation-service, fleet-service, automation-service: HTTP with the operator's Clerk bearer, through CloudFront paths; contracts at each provider's `openapi.json` (automation-service: no spec, routes in its README "API" and "Authentication" sections)
- automation-service → agent-service, fleet-service, navigation-service: HTTP with an M2M bearer from auth-service
- automation-service → ai-service: anomaly webhook `POST /webhooks/anomaly` (`generic` format; `telegram` pages a chat instead); ai-service → automation-service: knobs (policy class only), digest, replan, events
- spacetraders-mcp-server → automation-service (knobs, replan, metrics) and SpaceTraders directly
- agent-service, fleet-service, navigation-service, auth-service → st-gateway `/proxy/<SpaceTraders path>`; st-gateway → SpaceTraders, injecting the agent token it fetches from auth-service `GET /auth/v1/token`
- fleet-service → agent-service `POST /contracts/{id}/deliveries`
- every verifier (agent, fleet, navigation, automation, st-gateway) → auth-service `POST /auth/v1/introspect`; contract `meta/docs/design/token-introspection.md` + `meta/fixtures/introspection.json`
- automation-service, ai-service → auth-service `POST /auth/v1/m2m-token`
- agent-, automation-, fleet-service, st-gateway → `@v-m-pioneer-trading/clerk-client` 2.0.1; ai-service still pins its predecessor `@v-m-pioneer-trading/introspection-client` 1.2.0 (M2M only)
- agent-, auth-, automation-, fleet-service, st-gateway, command-interface, clerk-client → `@v-m-pioneer-trading/eslint-config` 1.1.0; ai-service has no lint config. All are release tarballs pinned by URL
- agent-, auth-, automation-, fleet-, navigation-service and st-gateway CI → V-M-Pioneer-Trading_infrastructure's SSM bootstrap documents on push to main; agent-, auth-, fleet- and navigation-service CI → meta's reusable `openapi-sync.yml`. ai-service has no CI

## Cross-repo traps

- Push to main deploys production in every service repo with CI (SSM redeploy, or S3 sync for command-interface); ai-service has no CI and is not deployed. Infra is applied by hand.
- A shared-package change lands in three steps: provider PR, release tag, then one bump PR per consumer.
- A fixture change goes to `meta/fixtures/` first. `introspection.json` copies are byte-identical; `gateway-errors.json` copies differ only in their `$comment` line. Five copies are sha256-pinned (the four introspection copies and agent-service's gateway-errors copy): re-vendor updates the pin in the same PR.
- `meta/openapi/*.json` are bot-written copies; edit the service's own `openapi.json`.
- auth-service's two secrets (`AUTH_SERVICE_SHARED_SECRET`, `AUTH_INTROSPECTION_SECRET`) must differ; st-gateway crash-loops without either.
- An infra PR that adds an SSM document parameter is applied before the service CI change that passes it, or SSM rejects the deploy.
- Ports: command-interface defaults `VITE_NAVIGATION_SERVICE_URL` to :8081, navigation-service listens on :8080.
