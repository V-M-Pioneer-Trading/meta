# Workspace

This repo is the **tickets repo** of a multi-repo workspace. Mode rules live in the `heinzelwerk:team-modes` skill.

- **Tickets**: V-M-Pioneer-Trading/meta, the source of truth for the workspace: tickets, this file, `GLOSSARY.md`, workspace-wide ADRs (`docs/design/*-design.md` Decisions), learnings
- **Autonomy**: full (see each repo's `team.md`). A merge to main deploys to production in agent-service, auth-service, automation-service, fleet-service, navigation-service, st-gateway and command-interface
- **Layout**: every repo is checked out side by side under one unversioned folder; dir names below are those checkouts

## Repos

| Dir | GitHub | Role (owner) | Checks |
|---|---|---|---|
| meta | V-M-Pioneer-Trading/meta | tickets, docs, contract fixtures, compose (tech-lead docs PRs) | see `docs/agents/heinzelwerk/team.md` |
| agent-service | V-M-Pioneer-Trading/agent-service | backend | see `../agent-service/docs/agents/heinzelwerk/team.md` |
| auth-service | V-M-Pioneer-Trading/auth-service | backend | see `../auth-service/docs/agents/heinzelwerk/team.md` |
| automation-service | V-M-Pioneer-Trading/automation-service | backend | see `../automation-service/docs/agents/heinzelwerk/team.md` |
| fleet-service | V-M-Pioneer-Trading/fleet-service | backend | see `../fleet-service/docs/agents/heinzelwerk/team.md` |
| navigation-service | V-M-Pioneer-Trading/navigation-service | backend (Java) | see `../navigation-service/docs/agents/heinzelwerk/team.md` |
| st-gateway | V-M-Pioneer-Trading/st-gateway | backend | see `../st-gateway/docs/agents/heinzelwerk/team.md` |
| ai-service | V-M-Pioneer-Trading/ai-service | backend (not deployed) | see `../ai-service/docs/agents/heinzelwerk/team.md` |
| spacetraders-mcp-server | V-M-Pioneer-Trading/spacetraders-mcp-server | backend (local MCP tool) | see `../spacetraders-mcp-server/docs/agents/heinzelwerk/team.md` |
| command-interface | V-M-Pioneer-Trading/command-interface | frontend | see `../command-interface/docs/agents/heinzelwerk/team.md` |
| ts-introspection-client | V-M-Pioneer-Trading/clerk-client | backend (shared package) | see `../ts-introspection-client/docs/agents/heinzelwerk/team.md` |
| eslint-config | V-M-Pioneer-Trading/eslint-config | backend (shared package) | see `../eslint-config/docs/agents/heinzelwerk/team.md` |
| V-M-Pioneer-Trading_infrastructure | V-M-Pioneer-Trading/infrastructure | infra | see `../V-M-Pioneer-Trading_infrastructure/docs/agents/heinzelwerk/team.md` |

`spacetraders-api-docs` (SpaceTradersAPI/api-docs) is the upstream API reference, read-only; mcp-server's `generate:client` reads it.

## Who calls whom

Request path in production: browser → CloudFront → Caddy (infrastructure `caddy/`) → service; every SpaceTraders call → st-gateway → api.spacetraders.io.

- command-interface → agent-, navigation-, fleet-, automation-service (provider): HTTP with the operator's Clerk session; health only for auth-service, st-gateway, ai-service
- automation-service → agent-, fleet-, navigation-service (provider): HTTP with an M2M bearer from auth-service
- ai-service → automation-service (provider): HTTP knobs, replan, events, with an M2M bearer
- spacetraders-mcp-server → SpaceTraders (direct, own token) and automation-service (no auth)
- fleet-service → agent-service (provider): `POST /contracts/{id}/deliveries`, best effort
- agent-, auth-, fleet-, navigation-service → st-gateway (provider): `/proxy/*`
- st-gateway → auth-service (provider): `GET /auth/v1/token` (game token)
- agent-, automation-, fleet-, navigation-service, st-gateway → auth-service (provider): `POST /auth/v1/introspect` (decision 21); automation-service and ai-service → `POST /auth/v1/m2m-token` (decision 22)
- agent-, automation-, fleet-service, st-gateway → clerk-client (provider): release tarball; seven TS repos → eslint-config (provider): release tarball
- clerk-client, auth-, navigation-service, st-gateway → meta (provider): vendored `fixtures/introspection.json`, pinned by sha256 in each repo's SOURCE file; agent-, fleet-, navigation-service → meta: vendored `fixtures/gateway-errors.json`
- agent-, auth-, fleet-, navigation-service → meta: `openapi.json` mirrored into meta `openapi/` by the reusable `openapi-sync.yml@main`
- service repos' deploy jobs → infrastructure: SSM document `<svc>-bootstrap-<instance>` (st-gateway deploys through agent-service's)

## Cross-repo traps

- A contract change starts in the provider: a fixture change lands in meta first, then one re-vendor task per consumer; a clerk-client change ships as a tag + release, then one bump per consumer.
- A new env var a service requires lands in infrastructure (and meta `docker-compose.yml`) before the image deploys; otherwise the container crash-loops behind green CI.
- `docker restart` or a deploy of automation-service brings the autopilot back in shadow; live trading resumes only when the operator re-arms (autopilot-design decision 13).
- After a SpaceTraders universe reset, `MINING_SHIP_SYMBOL` in the automation-service stack names a ship the agent no longer owns.
- Required check names are workflow job ids; renaming a job blocks every merge until branch protection is updated.
