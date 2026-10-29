# Workspace

This repo is the **tickets repo** of a multi-repo workspace. Mode rules live in the `heinzelwerk:team-modes` skill. Verified against cd0b1eb 2026-10-29.

- **Tickets**: V-M-Pioneer-Trading/meta, the source of truth for the workspace: tickets, this file, `GLOSSARY-MAP.md`, workspace-wide ADRs, learnings
- **Autonomy**: full (see each repo's `team.md`)
- **Integration** (validator runs it across all touched repos on the shared branch name): `docker compose up --build` from `meta/` with all siblings checked out (`README.md:53-56`, `docker-compose.yml:1`) `(unverified locally: Docker daemon not running)`. Also builds parked `../ai-service` (`docker-compose.yml:240`); `MINING_SHIP_SYMBOL` and `OPENAI_API_KEY` have no default (`.env.example:6,9`)

## Repos

| Dir | GitHub | Role (owner) | Checks |
|---|---|---|---|
| agent-service | V-M-Pioneer-Trading/agent-service | backend | see `../agent-service/docs/agents/heinzelwerk/team.md` |
| auth-service | V-M-Pioneer-Trading/auth-service | backend | see `../auth-service/docs/agents/heinzelwerk/team.md` |
| automation-service | V-M-Pioneer-Trading/automation-service | backend | see `../automation-service/docs/agents/heinzelwerk/team.md` |
| fleet-service | V-M-Pioneer-Trading/fleet-service | backend | see `../fleet-service/docs/agents/heinzelwerk/team.md` |
| navigation-service | V-M-Pioneer-Trading/navigation-service | backend | see `../navigation-service/docs/agents/heinzelwerk/team.md` |
| st-gateway | V-M-Pioneer-Trading/st-gateway | backend | see `../st-gateway/docs/agents/heinzelwerk/team.md` |
| command-interface | V-M-Pioneer-Trading/command-interface | frontend | see `../command-interface/docs/agents/heinzelwerk/team.md` |
| V-M-Pioneer-Trading_infrastructure | V-M-Pioneer-Trading/infrastructure | infra | see `../V-M-Pioneer-Trading_infrastructure/docs/agents/heinzelwerk/team.md` |
| eslint-config | V-M-Pioneer-Trading/eslint-config | shared | see `../eslint-config/docs/agents/heinzelwerk/team.md` |
| ts-introspection-client | V-M-Pioneer-Trading/clerk-client | shared | see `../ts-introspection-client/docs/agents/heinzelwerk/team.md` |
| meta | V-M-Pioneer-Trading/meta | tickets/docs | see `docs/agents/heinzelwerk/team.md` |

## Who calls whom

- command-interface → agent-service (provider): HTTP reads + accept/fulfill/purchase/sell, `../command-interface/src/api/agentService.ts:19-51`; contract `openapi/agent-service.json`
- command-interface → fleet-service: HTTP ship actions, `../command-interface/src/api/fleetService.ts:23-80`; contract `openapi/fleet-service.json`
- command-interface → navigation-service: HTTP waypoint/market/shipyard reads, `../command-interface/src/api/navigationService.ts:19-28`; contract `openapi/navigation-service.json`
- command-interface → automation-service: HTTP autopilot/knobs/metrics, `../command-interface/src/api/automationService.ts:60-94`; no spec (`openapi/README.md:19`), types hand-kept vs `../automation-service/src` (`../command-interface/src/api/types.ts:1-12`)
- command-interface → every service's health route (incl. auth-service, st-gateway, ai-service): `../command-interface/src/api/healthService.ts:31-52`
- automation-service → agent-service, fleet-service, navigation-service: HTTP with its machine token, `../automation-service/src/gameClients.ts:343-437`; contracts `openapi/{agent,fleet,navigation}-service.json`
- automation-service → auth-service: `POST /auth/v1/m2m-token` via clerk-client, `../automation-service/src/config.ts:56-62,90`; contract `docs/design/auth-design.md` decision 22 (`:1417`)
- agent-, fleet-, automation-service, st-gateway → auth-service: `POST /auth/v1/introspect` via clerk-client (`../agent-service/src/server.ts:211`, `../fleet-service/src/server.ts:151`, `../automation-service/src/config.ts:197`, `../st-gateway/src/server.ts:189`); navigation-service with its own Java client (`../navigation-service/src/main/java/de/vnm/navigation/config/IntrospectionConfig.java:50-52`); contract `docs/design/token-introspection.md` + `fixtures/introspection.json`
- agent-, fleet-, navigation-, auth-service → st-gateway: HTTP `/proxy/<st-path>` (`../agent-service/src/config.ts:234`, `../fleet-service/src/spacetraders/client.ts:73`, `../navigation-service/src/main/resources/application.properties:18`, `../auth-service/src/config.ts:276`); contract `fixtures/gateway-errors.json` + `docs/design/upstream-errors.md`
- st-gateway → auth-service (vault): `GET /auth/v1/token` with `X-Auth-Service-Secret`, `../st-gateway/src/authServiceClient.ts:65`; contract `openapi/auth-service.json`, auth-design decision 9 (`docs/design/auth-design.md:555`)
- st-gateway → SpaceTraders API (external): `../st-gateway/src/config.ts:75`; contract upstream `spacetraders-api-docs` (out of scope)
- auth-service → Clerk API (external): `POST /v1/m2m_tokens`, `../auth-service/src/m2m/clerk.ts:5`
- fleet-service → agent-service: `POST /contracts/{id}/deliveries`, best effort, `../fleet-service/src/controllers/contracts.controller.ts:50`; contract `openapi/agent-service.json`
- agent-, fleet-, automation-service, st-gateway → ts-introspection-client: shared package, release tarball v2.0.1 (`../agent-service/package.json:24`, `../fleet-service/package.json:20`, `../automation-service/package.json:19`, `../st-gateway/package.json:18`)
- agent-, auth-, automation-, fleet-service, st-gateway, ts-introspection-client, command-interface → eslint-config: shared package, release tarball v1.1.0 (e.g. `../agent-service/package.json:34`, `../command-interface/package.json:25` uses `/react`)
- agent-, auth-, fleet-, navigation-service → meta: reusable workflow `openapi-sync.yml@main` (`../agent-service/.github/workflows/container.yml:338`, `../auth-service/.github/workflows/container.yml:305`, `../fleet-service/.github/workflows/container.yml:230`, `../navigation-service/.github/workflows/container.yml:237`); contract `.github/workflows/openapi-sync.yml:45-56`
- auth-service, navigation-service, st-gateway, ts-introspection-client → meta: vendored `fixtures/introspection.json` with sha pin (`../auth-service/contract/fixtures/SOURCE.txt:5-6`, `../navigation-service/src/test/resources/introspection/SOURCE.txt:5-6`, `../st-gateway/src/__tests__/fixtures/SOURCE.txt:4,10`, `../ts-introspection-client/test/fixtures/SOURCE:4,10`)
- agent-, fleet-, navigation-service → meta: vendored `fixtures/gateway-errors.json` (`../agent-service/contract/fixtures/SOURCE.txt:5`, `../fleet-service/src/__tests__/gatewayErrorConformance.test.ts:6-7`, `../navigation-service/src/test/java/de/vnm/navigation/client/GatewayErrorConformanceTest.java:33-34`)
- infrastructure (Caddy) → navigation-, agent-, fleet-, automation-service, st-gateway health, auth-service public paths: reverse proxy, `../V-M-Pioneer-Trading_infrastructure/caddy/Caddyfile.tftpl:51-92`
- service CI (agent, auth, automation, fleet, navigation, st-gateway) → infrastructure: OIDC role `github-actions-ssm-deploy`, `ssm:SendCommand` on `<svc>-bootstrap-*` docs, `../V-M-Pioneer-Trading_infrastructure/ci-deploy-role/main.tf:88-99`
- out of scope: automation-service → ai-service anomaly webhook (`../automation-service/src/config.ts:152`, `docker-compose.yml:212`); ai-service → automation-service knobs/replan/events (`../ai-service/src/automationServiceClient.ts:83`) and → auth-service M2M (`../ai-service/src/server.ts:95`)

## Cross-repo traps

- Fixture pins: change `fixtures/*` first, then re-copy in every vendoring repo and update its SOURCE commit + sha and any code literal (`../navigation-service/src/test/resources/introspection/SOURCE.txt:16`, `../st-gateway/src/__tests__/lane.conformance.test.ts:30`, `../ts-introspection-client/test/conformance.test.ts:69-71`, `../navigation-service/src/test/java/de/vnm/navigation/introspection/web/IntrospectionConformanceTest.java:72`). `introspection.json` stays `-text` (`.gitattributes:10`)
- openapi-sync: called `@main` by four backends, so a meta change lands in their next main run (`.github/workflows/validate.yml:48-51`); a new service needs its name in `SERVICES` here (`scripts/validate-openapi.mjs:27`, `openapi/README.md:23-25`)
- clerk-client / eslint-config: a change ships only after release (tag = `package.json` version, on main) and a manual URL + lockfile bump in each consumer (`../ts-introspection-client/README.md:658-661`, `../eslint-config/README.md:204-212`)
- ai-service still pins old `introspection-client` v1.2.0 from the pre-rename repo URL (`../ai-service/package.json:17`)
- Deploy rides SSM docs: st-gateway has no stack and redeploys through agent-service's doc, restarting its MySQL (`../st-gateway/.github/workflows/container.yml:168-171`); a `terraform apply` that changes a doc re-runs bootstrap and restarts containers (`../V-M-Pioneer-Trading_infrastructure/README.md:393-395`); never apply during a service CI deploy (`../V-M-Pioneer-Trading_infrastructure/README.md:134-136`)
- Env vars land in infra before images need them: apply the stack first, or the image crash-loops behind a green run (`../st-gateway/.github/workflows/container.yml:179-184`, `../fleet-service/CLAUDE.md:132`); same for SSM doc parameters (`../V-M-Pioneer-Trading_infrastructure/README.md:406-408`)
- Required check names = workflow job ids (and matrix values); renaming a job blocks every merge. Today: agent-service `test,image,contract`; auth-service `test,contract,ts-checks`; infrastructure `validate (<stack>)` x7; meta `validate`; all others `test` (verified 2026-10-29 @ cd0b1eb: `gh api repos/V-M-Pioneer-Trading/<repo>/branches/main/protection`)
- Branch protection: `enforce_admins` on, `strict` off, everywhere, so no direct push to main and no admin bypass (verified 2026-10-29 @ cd0b1eb: same `gh api`). Matrix trap: adding an infra stack to the matrix (`../V-M-Pioneer-Trading_infrastructure/.github/workflows/terraform.yml:20-27`) plus its required check blocks every open PR whose head predates it until rebased (unverified: recorded 2026-09-20, PR infrastructure#64)
- Secrets distinct: `AUTH_SERVICE_SHARED_SECRET`, `AUTH_INTROSPECTION_SECRET`, `M2M_CALLER_SECRET_*` pairwise different or auth-service refuses to start (`.env.example:33-36,44`)
