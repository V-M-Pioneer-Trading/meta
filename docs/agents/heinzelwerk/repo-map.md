# Repo map: meta

Facts verified against origin/main cd0b1eb on 2026-10-27, each with `path:line`. Line numbers drift: open the file before relying on one.

1. PURPOSE: Project-wide docs + local-dev orchestration for the SpaceTraders fleet; cross-cutting issues live here: README.md:3-7.
2. CONTENTS: openapi/{agent,auth,fleet,navigation}-service.json: one OpenAPI 3 spec per backend, never hand-edited, synced by workflow (openapi/README.md:3-10,12-17); automation-service, st-gateway publish none (:19).
- fixtures/introspection.json: version 7 (:3), contract for POST /auth/v1/introspect (:5-9). $comment (:2) says vendored verbatim by TS client pkg, agent-service (Go), navigation-service (Java), and says "NOT SHIPPED"; README.md:33 says shipped 2026-09-29.
- fixtures/gateway-errors.json: version 1 (:3); st-gateway failure cases, vendored by agent/fleet/navigation-service (:2).
- scripts/validate-openapi.mjs: rules :10-19, SERVICES allow-list :27, 2 MB cap :28, refuses CR :46, zero deps :21.
- scripts/validate-fixtures.mjs: 9 rules :16-32 (rule 1 = LF only), usage `[path ...]` :39, zero deps :34.
- scripts/mint-dev-token.mjs: RS256 dev JWT; flags :13-15; default scopes :26; sub user_localdev :34; 3600 s :35.
- tools/swagger2openapi/package.json: pins swagger2openapi 7.0.8 (:5-7), used only by sync (:4).
- docker-compose.yml (name spacetraders :1): st-gateway 3002 (:4-9), mysql 3306 (:30-35), agent-service 8080->80 (:49-54), navigation-service 8081->8080 (:77-82), fleet-service 3001 (:99-104), auth-service 8082->80 (:121-126), automation-postgres 5432 (:179-184), automation-service 3003 (:197-202), ai-service 3004 (:238-243).
- .env.example = compose overrides; .env gitignored (.gitignore:1). .gitattributes `* text=auto eol=lf` (:1), introspection.json `-text` (:10).
3. PUBLIC / SENSITIVE: Committed PRIVATE KEY dev-keys/dev-only-do-not-use.key.pem:1; deliberate, prod never trusts it (dev-keys/README.md:3-4, scripts/mint-dev-token.mjs:10-11, README.md:34-35). Also bind-mounted as auth-service M2M signing key (docker-compose.yml:159,169). Not a leak.
- Compose dev defaults: local-dev-auth-service-secret (:20,:142), local-dev-introspection-secret (:28,:68,:92,:115,:150,:219), local-dev-m2m-*-secret (:166-167,:225,:250), MySQL root "example" + user/pass (:37-40,:44,:58-59), Postgres "automation" (:187,:205). Prod has no fallback (:139-141).
- Real secrets belong in gitignored .env: CLERK_JWT_KEY (.env.example:20), Clerk Machine Secret Keys M2M_MACHINE_KEY_* (.env.example:56-59; compose :160-161). VITE_CLERK_PUBLISHABLE_KEY public by design (.env.example:22-24).
- meta repo is public (openapi-sync.yml:156); auth-service repo also public (openapi/README.md:20-21).
4. MONEY / SPEND: OPENAI_API_KEY to ai-service (docker-compose.yml:253, .env.example:8-9).
- MINING_SHIP_SYMBOL = real ship autopilot drives (docker-compose.yml:211, .env.example:4-6); st-gateway hits https://api.spacetraders.io/v2 (docker-compose.yml:12). Default dev token carries fleet:control + universe:refresh (mint-dev-token.mjs:26); dev-keys/README.md:42 example POSTs autopilot/abort.
- CI spends nothing: validate.yml read-only (:11-14). Only credential: openapi-sync App token (openapi-sync.yml:174-183).
5. DEPENDENCIES: Backends call `V-M-Pioneer-Trading/meta/.github/workflows/openapi-sync.yml@main`, spec-path openapi.json, secrets OPENAPI_SYNC_CLIENT_ID/PRIVATE_KEY (openapi-sync.yml:6-14); only caller-main tip proposes (:16-18,:195-201). Service name = caller repo name (:75-84); secrets granted to calling repos only (:40-42).
- One PR per service, branch openapi-sync/<repo> (:202), auto-merge squash (:227), author vmpt-openapi-sync[bot] (:216).
- Synced now: 4 services (openapi/README.md:12-17); README :36 says "three calling repositories" (stale vs 4).
- introspection fixture vendored verbatim with sha256 (validate.yml:38-40); re-vendor order docs/design/token-introspection.md:287-290,:333,:355.
- No runtime calls. Compose builds sibling ../<service> (docker-compose.yml:6,:51,:79,:101,:123,:199,:240).
6. VALIDATE / RUN LOCALLY: `node scripts/validate-fixtures.mjs`; `node scripts/validate-openapi.mjs` (validate.yml:46,:92). Node 22 (:36).
- `docker compose up --build` from meta/ with siblings + .env (README.md:53-59, docs/operations.md:6-35); then `npm run dev` in command-interface/ (README.md:59).
- `node scripts/mint-dev-token.mjs [--scopes fleet:control --sub user_local --expires 300]` (dev-keys/README.md:27,:36); curl example :42.
7. CI .github/workflows/validate.yml: on pull_request (no filter) + push main (:7-9); contents: read (:13-14); job validate ubuntu-latest (:17-18); required on main (openapi/README.md:27).
  1. actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0, fetch-depth 0 (:25-29) || 2. actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0, node 22; no cache/npm ci (:31-36)
  3. "Validate the conformance fixtures": node scripts/validate-fixtures.mjs (:45-46) || 4. "Lint the workflows": actionlint 1.7.12 linux_amd64, sha256 8aca8db9...a3d8, `-color` (:52-61)
  5. "Restrict openapi-sync pull requests to their own spec": if PR and (head openapi-sync/* or user vmpt-openapi-sync[bot]) (:72-73); head must be openapi-sync/<svc> (:79-82); `git diff --no-renames --name-status` must be exactly A|M openapi/<svc>.json (:83-89) || 6. "Validate the OpenAPI specs": node scripts/validate-openapi.mjs (:91-92)
- openapi-sync.yml: workflow_call, input spec-path, contents: read, concurrency per caller cancel-in-progress (:45-64). prepare (10 min, no token, :67-71): derive name; checkout@3d3c42e5 v7.0.1 persist-credentials false (:88-99); setup-node@82076278 v7.0.0 (:102); resolve path .json/no symlink/no escape (:108-118); convert 3.x as-is or swagger2openapi after `npm ci --ignore-scripts`, normalise (:120-135); upload-artifact@043fb46d v7.0.1, 1 day (:137-142). propose (10 min, :144-148): download-artifact@3e5f45b2 v8.0.1 (:151); checkout meta no token (:158-163); validate (:169-172); create-github-app-token@bcd2ba49 v3.2.0, contents+PR write (:174-183); tip check, no-diff closes stale PR, else switch/commit/push --force/pr create/merge --auto --squash (:185-227).
8. PERSISTENCE: n/a in repo. Compose volumes mysql_datavolume, nav_data, auth_data, automation_postgres_data (docker-compose.yml:257-261).
9. PATTERNS: zero-dep node scripts (validate.yml:31-33); actions pinned to SHA + version comment (validate.yml:20-24); converter job holds no token (openapi-sync.yml:28-35); LF only (.gitattributes:1, validate-openapi.mjs:46); secrets as same `${VAR:-local-default}` on both sides (docker-compose.yml:20,:28,:142,:150,:225); new spec = 2 PRs incl. SERVICES (openapi/README.md:23-25); no "auth off" mode (dev-keys/README.md:17-18, .env.example:14).
10. TRAPS: Unknown openapi/<name>.json fails (validate-openapi.mjs:27,:41); allow-list must land with first sync. Never hand-edit specs (openapi/README.md:3-4).
- No depends_on st-gateway->auth-service: cycle (docker-compose.yml:13-18,:171-175).
- Shared, introspection and each M2M caller secret must differ or auth-service won't start (docker-compose.yml:143-147,:162-165); one trust anchor: dev key XOR Machine keys (:154-158).
- Empty DEV_M2M_SIGNING_KEY_FILE without Machine keys stops auth-service (.env.example:53-57); compose `-` form keeps empty (docker-compose.yml:157-159).
- Byte change to introspection.json breaks every vendored sha256 (validate.yml:38-40, .gitattributes:3-10).
- openapi-sync.yml called @main by every backend; breakage breaks their deploys (validate.yml:48-51).
- Doc conflict: auth-design.md:1614-1615 says decision 23 not shipped, agent/auth-service still Go (README.md:42,:45 agree); openapi/README.md:9 says agent-service moved to TS (#103). docs/operations.md:357 says ai-service has no CI workflow (not checkable here)
11. DOCS (lines)
- README.md (60) index+services+quickstart; CONTEXT.md (63) glossary, "Identity and credentials" :7, "Traffic" :54, decisions live in docs/design/*-design.md :3-5. docs/algorithms.md (393); docs/architecture.md (284): "nine services" :22, key decisions :125; docs/operations.md (397): local :6, prod :120, CI :328, testing :365, tuning :379; dev-keys/README.md (70); openapi/README.md (36).
- auth-design.md (1972), "## Decisions" :175, 23 decisions: 1 Two Clerk apps :177 | 2 publicly readable/privately writable :192 | 3 live anon reads :254 | 4 auth-service owns game creds, authz a library :285 | 5 st-gateway injects agent token :337 | 6 account token persisted :393 | 7 re-register on observed reset :423 | 8 auto-disarm not auto-register :466 | 9 isolated by network/secret/firewall :555 | 10 networkless verify, local keypair :643 | 11 ai-service shared secret :698 | 12 sign-in Google-only headless :730 | 13 no login wall :741 | 14 stagehopper API Gateway verify :759 | 15 stagehopper Authorization header :796 | 16 stagehopper keyspace cutover :813 | 17 stagehopper vanilla clerk-js :828 | 18 Increment 2 transition window :841 | 19 automation-service Clerk M2M :898 | 20 universe:refresh scope :1013 | 21 One verifier :1054 (#### :1101-1352) | 22 auth-service mints machine tokens :1417 | 23 agent/auth-service Go->TS :1612 (#### :1628-1763).
- autopilot-design.md (165), "## Decisions" :39, 13 decisions: 1 automation-service engine :41 | 2 actions via existing services :45 | 3 st-gateway rate limiting :49 | 4 paste-to-arm token :53 | 5 V1 loops :59 | 6 planner + per-ship FSMs :67 | 7 scored credits/hour :75 | 8 ai-service knobs+replan :79 | 9 Postgres event log :102 | 10 safety rails :106 | 11 UI switch+dashboard :114 | 12 TypeScript :118 | 13 restart in shadow :122.
- autopilot-spec.md (101): "Implementation Decisions" :60, "Testing Decisions" :76, none numbered. token-introspection.md (602): conformance :251, machine tokens :541, cites decision 21 :10, none numbered. upstream-errors.md (124): conformance :77, none numbered.

## Reference docs

- `docs/design/token-introspection.md`: read when parsing Authorization, writing a route guard, or minting a machine token.
- `docs/design/upstream-errors.md`: read when changing how any client maps an st-gateway failure.
- `docs/design/auth-design.md` "Infrastructure posture": read before touching any stack, the authnet firewall, or the token route.
- `docs/design/autopilot-spec.md` "Testing Decisions": read before writing tests for automation-service or ai-service.
- `docs/algorithms.md`: read before changing scoring, the planner, or an anomaly threshold.
- `docs/architecture.md`: read before adding a service or changing who calls whom.
- `docs/operations.md`: read when running the stack locally, debugging a production route, or when auth-service is down (503s, lanes flipping to background).
- `dev-keys/README.md`: read before minting a dev token or touching the dev keypair.
- `openapi/README.md`: read before adding a service's spec.
