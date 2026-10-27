# Workspace

This repo is the **tickets repo** of a multi-repo workspace. Mode rules live in the `heinzelwerk:team-modes` skill.

- **Tickets**: V-M-Pioneer-Trading/meta, the source of truth for the workspace: tickets, this file, `GLOSSARY-MAP.md`, workspace-wide ADRs, learnings
- **Autonomy**: full (see each repo's `team.md`). A merge to `main` deploys production in every service repo and in command-interface.
- **Integration**: none. `docker compose up --build` in meta starts the whole stack for local dev, but no smoke test runs against it.

## Repos

| Dir | GitHub | Role (owner) | Checks |
|---|---|---|---|
| agent-service | V-M-Pioneer-Trading/agent-service | backend | see `agent-service/docs/agents/heinzelwerk/team.md` |
| auth-service | V-M-Pioneer-Trading/auth-service | backend | see `auth-service/docs/agents/heinzelwerk/team.md` |
| automation-service | V-M-Pioneer-Trading/automation-service | backend | see `automation-service/docs/agents/heinzelwerk/team.md` |
| fleet-service | V-M-Pioneer-Trading/fleet-service | backend | see `fleet-service/docs/agents/heinzelwerk/team.md` |
| navigation-service | V-M-Pioneer-Trading/navigation-service | backend | see `navigation-service/docs/agents/heinzelwerk/team.md` |
| st-gateway | V-M-Pioneer-Trading/st-gateway | backend | see `st-gateway/docs/agents/heinzelwerk/team.md` |
| ai-service | V-M-Pioneer-Trading/ai-service | backend | see `ai-service/docs/agents/heinzelwerk/team.md` |
| command-interface | V-M-Pioneer-Trading/command-interface | frontend | see `command-interface/docs/agents/heinzelwerk/team.md` |
| ts-introspection-client | V-M-Pioneer-Trading/clerk-client | shared package (backend owns) | see `ts-introspection-client/docs/agents/heinzelwerk/team.md` |
| eslint-config | V-M-Pioneer-Trading/eslint-config | shared package (backend owns) | see `eslint-config/docs/agents/heinzelwerk/team.md` |
| V-M-Pioneer-Trading_infrastructure | V-M-Pioneer-Trading/infrastructure | infra | see `V-M-Pioneer-Trading_infrastructure/docs/agents/heinzelwerk/team.md` |
| meta | V-M-Pioneer-Trading/meta | tickets, docs, contracts | see `meta/docs/agents/heinzelwerk/team.md` |

Not set up for agents: `spacetraders-mcp-server` (stale, may be removed; `npm ci` fails on its lockfile) and `spacetraders-api-docs` (upstream SpaceTradersAPI/api-docs, read-only reference).

## Who calls whom

- command-interface → agent-service, fleet-service, navigation-service, automation-service (provider): HTTP with the operator's Clerk token, contracts at each service's `openapi.json` (automation-service has none yet: meta#102)
- agent-service, fleet-service, navigation-service, automation-service, st-gateway → auth-service (provider): HTTP introspection, contract at `docs/design/token-introspection.md` and `fixtures/introspection.json`
- automation-service, ai-service → auth-service (provider): HTTP `POST /auth/v1/m2m-token` for machine tokens
- agent-service, fleet-service, navigation-service, auth-service → st-gateway (provider): HTTP `/proxy/*`, failure answers at `docs/design/upstream-errors.md` and `fixtures/gateway-errors.json`
- st-gateway → auth-service (provider): HTTP `GET /auth/v1/token` for the game token
- fleet-service → agent-service (provider): HTTP `POST /api/agent/v1/contracts/{id}/deliveries`
- automation-service → agent-service, fleet-service, navigation-service (provider): HTTP with its machine token
- ai-service → automation-service (provider): HTTP knobs, replan, events, digest; automation-service → ai-service: anomaly webhook
- agent-service, auth-service, automation-service, fleet-service, st-gateway → clerk-client (provider): release tarball dependency (ai-service still pins the old introspection-client 1.2.0)
- every TypeScript repo → eslint-config (provider): release tarball dev dependency
- agent-service, auth-service, fleet-service, navigation-service → meta (provider of the workflow): reusable `openapi-sync.yml@main`, which mirrors their `openapi.json` into `openapi/`
- infrastructure stacks → personal stack in mradomsky/infrastructure (provider): `terraform_remote_state`

## Cross-repo traps

- A change to `fixtures/*.json` here breaks the sha256-pinned copies in every service at once; change meta first, then re-vendor in each repo.
- Never hand-edit `openapi/*.json`: the sync overwrites them. A new service spec needs its name in `scripts/validate-openapi.mjs` first.
- A clerk-client or eslint-config change ships only after a tagged release and a dependency-URL bump in each consumer.
- Infra applies race a service's CI deploy on the same host; never run both at once.
- Every service merge to `main` redeploys production through SSM on one EC2 host; command-interface syncs S3 with `--delete`.
