# Repo map: V-M-Pioneer-Trading/meta
Verified against cd0b1eb 2026-10-29.

## Purpose
- Project-wide docs, local-dev compose and cross-cutting issues for the SpaceTraders autopilot fleet; tickets repo of the workspace (`README.md:3-7`)
- No service code, no `package.json`; scripts are zero-dependency node (`.github/workflows/validate.yml:31-33`)

## Layout
- `fixtures/`: conformance fixtures other repos vendor (`fixtures/introspection.json`, `fixtures/gateway-errors.json`)
- `openapi/`: one OpenAPI 3 spec per backend, never hand-edited (`openapi/README.md:3-10`)
- `scripts/`: `mint-dev-token.mjs`, `validate-fixtures.mjs`, `validate-openapi.mjs` (`scripts/mint-dev-token.mjs:1`, `scripts/validate-fixtures.mjs:1`, `scripts/validate-openapi.mjs:1`)
- `tools/swagger2openapi/`: pinned converter (swagger2openapi 7.0.8) installed only by openapi-sync (`tools/swagger2openapi/package.json:6`, `.github/workflows/openapi-sync.yml:130-131`)
- `dev-keys/`: committed dev keypair (`dev-keys/README.md:3-4`)
- `docker-compose.yml`, `.env.example`: local stack (`docker-compose.yml:1`, `.env.example:6`)
- `docs/`: `algorithms.md`, `architecture.md`, `operations.md`, `design/` (`docs/algorithms.md:1`, `docs/architecture.md:1`, `docs/operations.md:1`)
- `GLOSSARY.md`: domain vocabulary; decisions live in `docs/design/*-design.md` (`GLOSSARY.md:3-5`)
- `GLOSSARY-MAP.md`: one context per repo and how they relate (`GLOSSARY-MAP.md:1-3`)

## Fixtures (provided)
- `fixtures/introspection.json` v7, sha256 `95cb78d8…cda2b`, 56 calling-service + 19 gateway cases (`fixtures/introspection.json:3`, `../st-gateway/src/__tests__/fixtures/SOURCE.txt:7-10`) (verified 2026-10-29 @ cd0b1eb: `sha256sum`)
- Only file marked `-text`; CRLF would break every consumer's sha pin (`fixtures/introspection.json`, `.gitattributes:10`)
- Vendored with pin at meta f226e5f: auth-service `../auth-service/contract/fixtures/SOURCE.txt:5-6`, navigation-service `../navigation-service/src/test/resources/introspection/SOURCE.txt:5-6`, st-gateway `../st-gateway/src/__tests__/fixtures/SOURCE.txt:4,10`, clerk-client `../ts-introspection-client/test/fixtures/SOURCE:4,10`
- Second pins in code: `../navigation-service/src/test/java/de/vnm/navigation/introspection/web/IntrospectionConformanceTest.java:72`, `../st-gateway/src/__tests__/lane.conformance.test.ts:30`, `../ts-introspection-client/test/conformance.test.ts:69-71`
- agent-, fleet-, automation-service, st-gateway get it via clerk-client 2.0.1 tarball, no copy (`../agent-service/package.json:24`, `../fleet-service/package.json:20`, `../automation-service/package.json:19`, `../st-gateway/package.json:18`)
- `$comment` still says "NOT SHIPPED" and calls agent-service Go: stale (`fixtures/introspection.json:2`)
- `fixtures/gateway-errors.json` v1: st-gateway failure conditions, normative for agent, fleet, navigation (`fixtures/gateway-errors.json:3`, `docs/design/upstream-errors.md:3-4`)
- Its copies replace line 2 `$comment`, so none is byte-verbatim; only agent-service pins a sha (`../agent-service/contract/fixtures/SOURCE.txt:5`, `../agent-service/contract/suites/pins.ts:22-24`)
- fleet-service and navigation-service copies: no pin file, docs say "verbatim" (`../fleet-service/src/__tests__/gatewayErrorConformance.test.ts:6-7`, `../navigation-service/src/test/java/de/vnm/navigation/client/GatewayErrorConformanceTest.java:33-34`)

## OpenAPI
- `openapi/{agent,auth,fleet,navigation}-service.json`; automation-service and st-gateway publish none (#102) (`openapi/README.md:12-19`)
- Callers `uses: …/openapi-sync.yml@main`, spec-path `openapi.json`: `../agent-service/.github/workflows/container.yml:338`, `../auth-service/.github/workflows/container.yml:305`, `../fleet-service/.github/workflows/container.yml:230`, `../navigation-service/.github/workflows/container.yml:237`
- New service = PR there plus PR here adding it to `SERVICES` (`openapi/README.md:23-25`, `scripts/validate-openapi.mjs:27`)

## openapi-sync.yml (reusable workflow)
- `workflow_call`, input `spec-path`, secrets `OPENAPI_SYNC_CLIENT_ID`/`OPENAPI_SYNC_PRIVATE_KEY` (`.github/workflows/openapi-sync.yml:45-56`)
- Concurrency `openapi-sync-<repo>`, cancel-in-progress (`.github/workflows/openapi-sync.yml:62-64`)
- Service name = caller repo name, never an input (`.github/workflows/openapi-sync.yml:77-84`)
- Swagger 2.0 converted in a job with no token (`.github/workflows/openapi-sync.yml:100,130-131`)
- Proposes only if caller's main tip == run sha, else exit 0 (`.github/workflows/openapi-sync.yml:195-201`)
- Already current: closes stale PR (`.github/workflows/openapi-sync.yml:207-215`); else force-push `openapi-sync/<service>`, `gh pr create`, `gh pr merge --auto --squash` (`.github/workflows/openapi-sync.yml:216-227`)

## Local stack (docker-compose.yml)
- Project `spacetraders` (`docker-compose.yml:1`); up from `meta/` with all siblings checked out: `docker compose up --build` (`README.md:53-56`, `docs/operations.md:30-34`)
- Host ports: st-gateway 3002 (`docker-compose.yml:9`), mysql 3306 (`:35`), agent-service 8080→80 (`:54`), navigation-service 8081→8080 (`:82`), fleet-service 3001 (`:104`), auth-service 8082→80 (`:126`), automation-postgres 5432 (`:184`), automation-service 3003 (`:202`), ai-service 3004 (`:243`)
- Builds `../<service>` incl. parked ai-service (`docker-compose.yml:240`); no command-interface: `npm run dev` there (`README.md:59-60`)
- `MINING_SHIP_SYMBOL`, `OPENAI_API_KEY` have no default (`.env.example:6,9`, `docker-compose.yml:211,253`)
- auth-service gets dev public key, dev M2M signing key, `./dev-keys` mounted read-only (`docker-compose.yml:137,159,169`)
- st-gateway has no `depends_on` auth-service on purpose: cycle (`docker-compose.yml:13-18`)
- Secrets must be pairwise distinct or auth-service won't start (`.env.example:33-36,44`)

## Scripts
- `mint-dev-token.mjs`: RS256 token against the dev key; default scopes fleet:control agent:reset universe:refresh events:write planner:advise (`scripts/mint-dev-token.mjs:7-26`)
- `validate-fixtures.mjs`: 9 structural checks on introspection.json (`scripts/validate-fixtures.mjs:14-32`)
- `validate-openapi.mjs`: 7 checks per spec + `SERVICES` allow-list (`scripts/validate-openapi.mjs:9-19,27`)

## CI
- `validate.yml`: `pull_request` (no branch filter) + push main, contents read, one job `validate` (`.github/workflows/validate.yml:3-18`)
- Steps: fixtures (`:45-46`), actionlint 1.7.12 sha256-checked (`:52-61`), openapi-sync PR restriction (`:72-89`), specs (`:91-92`) (`.github/workflows/validate.yml`)
- Required check on main: `validate`; enforce_admins on (verified 2026-10-29 @ cd0b1eb: `gh api repos/V-M-Pioneer-Trading/meta/branches/main/protection`)
- No deploy from this repo (`.github/workflows/`)

## Docs
- `docs/algorithms.md`: decision model `:27`, work loops `:186`, anomaly `:264`, shadow/replay `:292`, AI supervisor `:321`, gateway `:365`
- `docs/operations.md`: running locally `:6`, production `:122`, CI and deploys `:336`, testing `:373`, tuning `:387`
- `docs/architecture.md`: services `:82`, boundaries `:100`, key design decisions `:127` (unnumbered)
- ADRs: `docs/design/auth-design.md` "## Decisions" `:177`, 1–23; `docs/design/autopilot-design.md` "## Decisions" `:41`, 1–13
- `docs/design/token-introspection.md`: implements auth-design decision 21 (supersedes 4), meta#80 (`docs/design/token-introspection.md:9-11`)
- `docs/design/upstream-errors.md`: what services answer when st-gateway doesn't (`docs/design/upstream-errors.md:1-4`)

## Traps
- `dev-keys/dev-only-do-not-use.key.pem` committed on purpose; prod never trusts it; no "auth off" mode (`dev-keys/README.md:3-4,17-18`, `.env.example:14`)
- Fixture change: meta first, re-copy, update SOURCE commit + sha and code literals (`../navigation-service/src/test/resources/introspection/SOURCE.txt:16`)
- openapi-sync.yml called `@main` by every backend; breaking it breaks their main runs (`.github/workflows/validate.yml:48-51`)
- Sync PRs may touch only their own spec (`openapi/README.md:27-31`)
- `docs/design/token-introspection.md:3` says "decided, not shipped": stale vs `README.md:33` "shipped 2026-09-29"
- `openapi/README.md:36` says org secrets granted to "three calling repositories"; four call the workflow (unverified: org secret settings need org admin)
- `README.md:42,45` list agent-service and auth-service as Go; both moved to TypeScript (`docs/design/auth-design.md:1619`)

## Reference docs
- `docs/algorithms.md` "The decision model on one page": read when changing scoring weights or predicting which target the planner picks.
- `docs/algorithms.md` "The work loops": read when changing a mining, contract or scout task FSM.
- `docs/algorithms.md` "Anomaly detection": read when an anomaly fires or an `alert` knob is tuned.
- `docs/operations.md` "Production deployment": read when changing host networking, ports or Caddy routes in production.
- `docs/operations.md` "Health-check routing": read when adding a service to health monitoring or a CloudFront path.
- `docs/operations.md` "When auth-service is down": read when auth-service answers 503 or every lane goes background.
- `docs/design/auth-design.md` decisions 7–8 (incl. the two state axes table): read when touching auth-service's poller, register path or universe-reset handling.
- `docs/design/token-introspection.md` (situation table, "What is a bearer token, and what is not", "Minting a machine token"): read when writing or auditing a calling service's auth guard.
- `docs/design/upstream-errors.md` "The rule": read when writing a client's st-gateway error mapping.
- `docs/design/autopilot-spec.md` "Testing Decisions": read when writing st-gateway, automation-service or ai-service tests.
