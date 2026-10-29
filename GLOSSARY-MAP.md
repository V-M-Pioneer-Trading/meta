# Glossary map

One context per repo. The workspace glossary is `GLOSSARY.md` here in meta; no repo has its own yet. A repo-local `GLOSSARY.md` is created lazily at that repo's root when it coins a term the workspace glossary should not hold. Verified against meta cd0b1eb 2026-10-29.

## Contexts

| Context (dir) | Owns | Glossary |
|---|---|---|
| meta | docs, fixtures, OpenAPI specs, local compose (`README.md:3-7`) | `GLOSSARY.md` (workspace-wide) |
| auth-service | the vault (game + account tokens) and the center (token verification, M2M minting) (`GLOSSARY.md:43-46`, `../auth-service/src/config.ts:33-34`) | none yet, created lazily |
| st-gateway | rate budget, game-token injection, lanes (`../st-gateway/src/server.ts:239-240`) | none yet, created lazily |
| agent-service | agent, ships, contracts, trade/delivery history (`../agent-service/src/auth.ts:22-44`) | none yet, created lazily |
| fleet-service | ship actions (`../fleet-service/src/auth.ts:15`) | none yet, created lazily |
| navigation-service | cached waypoints, markets, shipyards; live fetch (`../navigation-service/src/main/java/de/vnm/navigation/service/LiveFetch.java:20-25`) | none yet, created lazily |
| automation-service | autopilot: planner, task loops, knobs, anomalies (`../automation-service/src/auth.ts:22,28,34`) | none yet, created lazily |
| command-interface | operator dashboard (`../command-interface/src/context/OperatorContext.ts:26-27`) | none yet, created lazily |
| ts-introspection-client (clerk-client) | client side of introspection, lane derivation, M2M token source (`../ts-introspection-client/src/gateway.ts:36`) | none yet, created lazily |
| eslint-config | shared lint rules; no domain terms (`../eslint-config/package.json:4`) | none yet, created lazily |
| V-M-Pioneer-Trading_infrastructure | Terraform for the backend containers (`../V-M-Pioneer-Trading_infrastructure/README.md:3-11`) | none yet, created lazily |
| ai-service, spacetraders-mcp-server | parked, out of scope; terms in `GLOSSARY.md` still apply where a contract crosses them | none |

## How the contexts relate

- **Operator** (`GLOSSARY.md:9`): command-interface signs one in with Clerk and sends the session as Bearer (`../command-interface/src/api/client.ts:94-97`); every backend asks the center about it.
- **Machine** (`GLOSSARY.md:11`): automation-service and ai-service, each minted a token by auth-service with fixed scopes (`../auth-service/src/config.ts:33-34`); automation-service fetches it via clerk-client (`../automation-service/src/config.ts:90`).
- **Visitor** (`GLOSSARY.md:15`): served anonymously by navigation-service cache reads (`../navigation-service/src/main/java/de/vnm/navigation/service/LiveFetch.java:20-25`), automation-service reads, agent-service history reads (`../agent-service/src/auth.ts:42-43`).
- **Scope** (`GLOSSARY.md:18`): `fleet:control` gates agent-, fleet-, automation-service mutations (`../agent-service/src/auth.ts:34`, `../fleet-service/src/auth.ts:15`, `../automation-service/src/auth.ts:22`); `agent:reset` gates auth-service Reset/Restore (`../auth-service/src/vault.ts:37`, `../auth-service/src/controllers/operator.controller.ts:63,86`); `universe:refresh` gates navigation-service refresh POSTs (`../navigation-service/src/main/java/de/vnm/navigation/auth/Scopes.java:12`); `events:write` and `planner:advise` gate automation-service `/events`, replan and knob writes (`../automation-service/src/auth.ts:28,34`), granted to ai-service's machine (`../auth-service/src/config.ts:34`) and checked by command-interface's knob editor (`../command-interface/src/api/automationService.ts:20`).
- **M2M token** (`GLOSSARY.md:41`): auth-service mints it, 24 h (`../auth-service/src/controllers/m2m.controller.ts:22`, `../auth-service/src/m2m/clerk.ts:23-24`); automation-service (`fleet:control`) and ai-service (`events:write planner:advise`) hold one (`../auth-service/src/config.ts:33-34`); automation-service fetches it through clerk-client (`../automation-service/src/config.ts:90`).
- **Token renewal** (`GLOSSARY.md:43`): one renewal point on both sides, auth-service's cache (`../auth-service/src/m2m/token.ts:65`) and clerk-client's token source (`../ts-introspection-client/src/m2mToken.ts:131`).
- **No credential** / **Declaration** (`GLOSSARY.md:50-56`): defined once in clerk-client (`../ts-introspection-client/src/core.ts:99`, `../ts-introspection-client/src/core.ts:345`) for agent-, fleet-, automation-service and st-gateway; navigation-service's Java client implements the same; `fixtures/introspection.json` binds all of them.
- **Game token** / **Account token** (`GLOSSARY.md:57-61`): held by auth-service; st-gateway fetches the game token over `GET /auth/v1/token` and injects it (`../st-gateway/src/authServiceClient.ts:65`). No other service holds one (`../fleet-service/src/spacetraders/client.ts:73`).
- **Universe reset** (`GLOSSARY.md:62`): auth-service detects it from SpaceTraders' root, polled through st-gateway with credential mode `none` (`../auth-service/src/poller.ts:172-175`, `../st-gateway/src/server.ts:150-151`).
- **The center** / **vault** (`GLOSSARY.md:74-77`): auth-service, one process, two roles (`../auth-service/src/vault.ts:1-5`).
- **Introspection** (`GLOSSARY.md:78`): agent-, fleet-, automation-service, st-gateway via clerk-client (`../agent-service/src/server.ts:211`, `../fleet-service/src/server.ts:151`, `../automation-service/src/config.ts:197`, `../st-gateway/src/server.ts:189`); navigation-service with its own Java client (`../navigation-service/src/main/java/de/vnm/navigation/config/IntrospectionConfig.java:50-52`). Contract: `docs/design/token-introspection.md`, `fixtures/introspection.json`.
- **`kind`** (`GLOSSARY.md:82`): read by st-gateway for the lane (`../ts-introspection-client/src/gateway.ts:36`) and by automation-service to limit machine knob writes (`../automation-service/src/server.ts:529`).
- **Live fetch** / **Refresh** (`GLOSSARY.md:87-89`): navigation-service's cache-miss and refresh paths (`../navigation-service/src/main/java/de/vnm/navigation/service/LiveFetch.java:20-25`), all through st-gateway `/proxy` (`../navigation-service/src/main/resources/application.properties:18`).
- **Priority** / **lane** (`GLOSSARY.md:90-94`): derived only by st-gateway from the center's answer (`../st-gateway/src/server.ts:239-240`); callers forward the caller's Authorization and never declare a lane (`../fleet-service/src/spacetraders/client.ts:73`).
- **Rate budget** (`GLOSSARY.md:95`): held by st-gateway's token bucket (`../st-gateway/src/tokenBucket.ts:22-31`); every service's live fetch spends it, navigation-service's `universe:refresh` routes deliberately (`docs/design/auth-design.md:1015`).
- **Credential mode** (`GLOSSARY.md:98`): decided by st-gateway alone (`../st-gateway/src/server.ts:148-154`); `forward` carries auth-service's account token on Reset Agent, `none` serves auth-service's poll of the root.
- **Calling service** (`GLOSSARY.md:102`): agent-, fleet-, navigation-service toward st-gateway (`docs/design/upstream-errors.md:3-4`), and every service that asks the center (`docs/design/token-introspection.md:25`).
- Upstream failures: every st-gateway client answers per `fixtures/gateway-errors.json` (`docs/design/upstream-errors.md:3-4`), ADR `docs/adr/0002-relay-gateway-answers.md`.
- **Autopilot status** / **mode** (`GLOSSARY.md:108-113`): owned by automation-service (`../automation-service/src/autopilotState.ts:1-2`); command-interface offers pause and abort from it (`../command-interface/src/components/autopilot/AutopilotPanel.tsx:56-57`).
- **Knob** classes (`GLOSSARY.md:116-122`): automation-service defines them (`../automation-service/src/knobs.ts:28`) and fences a machine (ai-service) to `policy` by `kind` (`../automation-service/src/server.ts:518,529`).
- **Anomaly** (`GLOSSARY.md:136`): raised by automation-service (`../automation-service/src/anomaly.ts:118-128`), paged to the URL infrastructure wires from SSM (`../V-M-Pioneer-Trading_infrastructure/automation-service/main.tf:315-318`).
- Decisions behind these terms: `docs/adr/`, `docs/design/auth-design.md` "## Decisions" (`docs/design/auth-design.md:177`), `docs/design/autopilot-design.md` "## Decisions" (`docs/design/autopilot-design.md:41`).
