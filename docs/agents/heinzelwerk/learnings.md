# Agent learnings

Curated by tech-lead at the end of each team run, merged by a human. Max 80 lines. Hard-to-reverse decisions go to docs/adr/, terms to `GLOSSARY.md`. This file holds the rest. Verified against cd0b1eb 2026-10-29.

<!-- format: - **<warning|discovery|codebase>** (#<ticket> | adopted: <path>): <one line>, see <path:line> | (unverified) | (verified <date> @ <sha>: <how>) -->

## meta
- **warning** (adopted: meta/docs/design/auth-design.md): auth-service down refuses every token-carrying request with 503, public GETs included; only tokenless reads survive, see fixtures/introspection.json:668
- **codebase** (adopted: meta/docs/design/upstream-errors.md): a gateway-errors case bounding a message length must also assert `messageNotEmpty`, else an empty message passes, see fixtures/gateway-errors.json:101
- **warning** (adopted: meta/dev-keys/README.md): dev keypair covers backend only; the real dashboard locally needs a Clerk development instance, no fake-session path, see ../command-interface/src/main.tsx:23
- **discovery** (adopted: meta/dev-keys/README.md): CI never uses the committed dev keypair; auth-service tests generate ephemeral keys, see ../auth-service/src/testSupport/keyCases.ts:91

## V-M-Pioneer-Trading_infrastructure
- **warning** (adopted: meta/docs/design/auth-design.md): authnet iptables guards must match auth-service's single IP (a /32), never the subnet; a subnet rule broke CloudFront ingress and st-gateway DNS on 2026-08-23 with every `/health` 200, see ../V-M-Pioneer-Trading_infrastructure/auth-service/main.tf:346
- **warning** (adopted: V-M-Pioneer-Trading_infrastructure/README.md): set `anomaly_webhook_format`/`anomaly_telegram_chat_id` in automation-service's terraform.tfvars, never `-var`; the next apply silently reverts to `generic`, see ../V-M-Pioneer-Trading_infrastructure/automation-service/variables.tf:46
- **warning** (adopted: V-M-Pioneer-Trading_infrastructure/README.md): bootstrap scripts must `docker stop -t 9 <svc>` before `docker rm -f` (SIGKILL skips graceful shutdown), see ../V-M-Pioneer-Trading_infrastructure/automation-service/main.tf:338

## agent-service
- **codebase** (adopted: agent-service/README.md): keep `GET /api/agent/health`; CloudFront routes only `/api/agent/v1/*` and this path, so it is the only public health path, see ../agent-service/src/auth.ts:24
- **discovery** (adopted: agent-service/README.md): table `contracts` is insert-only; no query reads it, see ../agent-service/src/db/history.ts:85
- **codebase** (adopted: agent-service/README.md): `GET /current-agent` makes three serial gateway calls (shared rate budget); worst case 3x the 30 s timeout, see ../agent-service/src/controllers/agent.controller.ts:30
- **warning** (adopted: agent-service/README.md): an upstream 401 (st-gateway's injected credential rejected) is relayed like an invalid session; only the text/plain body differs, see ../agent-service/src/gateway/errors.ts:145
- **warning** (adopted: agent-service/README.md): migration is check-then-create with no lock; two boots on a fresh DB can race on `CREATE INDEX` (prod runs one instance); test migration changes on an empty DB, since `IF NOT EXISTS` hides schema drift, see ../agent-service/src/db/migrate.ts:97
- **codebase** (adopted: agent-service/contract/README.md): no 405 under `/api/agent`: wrong method is 404 `404 page not found\n`; outside the prefix it is a bare 405, see ../agent-service/src/http/muxCompat.ts:167
- **codebase** (adopted: agent-service/contract/README.md): `GET /ships/purchase` is the ship named "purchase"; `/ships/purchase` is POST-only, see ../agent-service/src/auth.ts:29
- **codebase** (adopted: agent-service/contract/README.md): HEAD runs the GET handler, so HEAD on a proxied route calls st-gateway and spends rate budget, see ../agent-service/contract/suites/head.ts:2
- **warning** (adopted: meta/docs/operations.md): login shows bare "Failed to fetch" with green health when a backend omits `Authorization` from `Access-Control-Allow-Headers`; every backend must list it, see ../agent-service/src/http/cors.ts:13

## auth-service
- **warning** (adopted: auth-service/README.md): never delete `/data/auth.db` to fix a deploy; its `credential` row is the only copy of the agent and account tokens, see ../auth-service/src/db/schema.ts:1
- **codebase** (adopted: auth-service/contract/README.md): `/introspect` parse errors in the URL query (`?%zz`, `;`) or body make the whole request `{active:false}` even with a valid token, see ../auth-service/src/introspection.ts:87
- **codebase** (adopted: auth-service/contract/README.md): the 10 s forced-poll cooldown is one global window armed before the poll runs, so a failing forced poll still consumes it, see ../auth-service/src/poller.ts:128
- **warning** (adopted: auth-service/contract/README.md): a SpaceTraders root lacking `resetDate` overwrites stored dates with null, and a null stored date hides the next wipe, see ../auth-service/src/poller.ts:172
- **codebase** (adopted: auth-service/contract/fixtures/SOURCE.txt): in the fixture only the `contract` block and each case's `center` object are normative; client `cases`/`gatewayCases` are not implemented here, see ../auth-service/contract/fixtures/SOURCE.txt:19
- **warning** (adopted: meta/docs/design/auth-design.md): disabling a caller or dropping a scope does not revoke minted M2M tokens; they live to `exp` (24 h); only rotating the Clerk instance key kills them, see ../auth-service/src/m2m/clerk.ts:23
- **codebase** (adopted: meta/docs/design/auth-design.md): re-registration reuses the stored call sign and email; never drop `email` from the register call, see ../auth-service/src/poller.ts:186

## automation-service
- **warning** (adopted: meta/docs/design/auth-design.md): the policy-only knob fence keys on `kind`; `planner:advise` also writes `model` and `alert` knobs, so never grant it to a narrower human account without revisiting the fence, see ../automation-service/src/server.ts:503
- **warning** (adopted: automation-service/README.md): keep `ANOMALY_INTERVAL_MS` below `anomaly.dedupeCooldownMinutes`; `repeated_denied` reads only events inside the window, see ../automation-service/src/anomaly.ts:341
- **codebase** (adopted: automation-service/CHANGELOG.md): with no webhook configured, delivery attempts are deliberately not counted, else the retry budget burns and the full history pages once a URL appears, see ../automation-service/src/anomalyScheduler.ts:218
- **codebase** (adopted: meta/docs/algorithms.md): a never-mined field scores on the fleet-wide average (or prior), a mean with no uncertainty, see ../automation-service/src/observations.ts:80
- **codebase** (adopted: meta/docs/algorithms.md): `npm run replay` re-scores only field choice, not contract/scout wins; zero flips means the knob change does nothing, see ../automation-service/src/replay.ts:28

## st-gateway
- **warning** (adopted: st-gateway/README.md): queues drain strictly interactive-first, no fairness cap; sustained operator traffic can starve background (autopilot), see ../st-gateway/src/tokenBucket.ts:76
- **warning** (adopted: st-gateway/README.md): a failing center (rotated `AUTH_INTROSPECTION_SECRET`, trailing-slash URL) silently demotes every operator to background; one `console.warn` per minute is the only signal, see ../st-gateway/src/server.ts:64
- **codebase** (adopted: st-gateway/README.md): `/metrics` latency counters are cumulative for the process life, so a bad minute is diluted, see ../st-gateway/src/tokenBucket.ts:63

## fleet-service
- **discovery** (adopted: fleet-service/README.md): no retries on any upstream call; one failed fetch fails the request, see ../fleet-service/src/spacetraders/client.ts:73
- **warning** (adopted: fleet-service/README.md): response bodies are untyped `Record<string, unknown>` passthrough, so an upstream schema change reaches command-interface unannounced, see ../fleet-service/src/controllers/ships.controller.ts:13
- **codebase** (adopted: fleet-service/README.md): `CORS_ALLOWED_ORIGIN` is a single string, not a list, see ../fleet-service/src/config.ts:25

## navigation-service
- **warning** (adopted: navigation-service/README.md): waypoints and shipyards have no TTL; a mutated object stays wrong until `forceRefresh=true`, see ../navigation-service/src/main/java/de/vnm/navigation/service/WaypointService.java:25
- **discovery** (adopted: navigation-service/README.md): first listing of a system walks every upstream page before answering (all-or-nothing), see ../navigation-service/src/main/java/de/vnm/navigation/service/WaypointService.java:118
- **codebase** (adopted: navigation-service/README.md): `markets` and `shipyards` rows are never evicted; the SQLite file grows with waypoints ever visited, see ../navigation-service/src/main/java/de/vnm/navigation/repository/WaypointRepository.java:56

## command-interface
- **discovery** (adopted: command-interface/README.md): knob saves are last-write-wins; the PUT sends only `{value}` with no version, see ../command-interface/src/api/automationService.ts:92

## eslint-config
- **warning** (adopted: eslint-config/README.md): one eslint-config release does not lint identically across consumers: caret peers (typescript-eslint, react-hooks deps) resolve per lockfile, see ../eslint-config/package.json:47
- **warning** (adopted: eslint-config/README.md): a `vite.config.ts` gets type info via the project service and must be in a tsconfig, else ESLint reports it not found; command-interface keeps `vite.config.js`, see ../eslint-config/index.js:137

## ts-introspection-client
- **codebase** (adopted: meta/docs/design/token-introspection.md): any center non-2xx is `unavailable` (503), including the center's 401 (about our secret); never relay it as 401, see ../ts-introspection-client/src/center.ts:197
- **codebase** (adopted: meta/docs/design/token-introspection.md): scopes split on SPACE/TAB/CR/LF only (not `/\s+/`); an active answer may omit `scope`, read as "", see ../ts-introspection-client/src/center.ts:39
- **codebase** (adopted: meta/docs/design/token-introspection.md): HEAD/OPTIONS are exempt from default-deny only; HEAD on a guarded route still needs its GET requirement, see ../ts-introspection-client/src/core.ts:18
