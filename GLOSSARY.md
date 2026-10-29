# Domain glossary

The names this system uses for things, so code, docs and conversation agree.
Design decisions themselves live in `docs/design/*-design.md` as numbered
decisions; this file only fixes vocabulary.

## Identity and credentials

- **Operator** — a human signed in with Clerk from the dashboard. Carries a
  **session** whose `scope` claim lists their permissions.
- **Machine** — a non-human caller with its own Clerk identity
  (automation-service). Its token's `sub` starts `mch_`; an operator's starts
  `user_`. The center reports that distinction as **`kind`**, and st-gateway
  picks a queue from it.
- **Visitor** — anyone with no session. May read what a backend serves
  anonymously; may not cause a live upstream call except where a backend
  explicitly allows it.
- **Scope** — a permission literal in the session token. Five exist:
  - `fleet:control` — driving the fleet. Reversible, but moves credits and
    ships.
  - `agent:reset` — **Reset Agent** / **Restore Token**. Irreversible and
    credential-bearing.
  - `universe:refresh` — force navigation-service to re-fetch universe data
    live. Spends the shared rate budget; moves nothing. Not implied by
    `fleet:control`.
  - `events:write` — write AI audit entries into automation-service's event
    log. Not implied by `fleet:control`.
  - `planner:advise` — advise the autopilot's planner: trigger a **replan** or
    write a **knob**. Not implied by `fleet:control`.

  Which routes each one actually gates is in auth-design.md, not this list: the
  table in [decision 2](docs/design/auth-design.md#2-spacetraders-is-publicly-readable-and-privately-writable)
  for `fleet:control` and `agent:reset`,
  [decision 20](docs/design/auth-design.md#20-universerefresh-a-third-scope-for-spending-the-rate-budget-without-moving-the-fleet)
  for `universe:refresh`, and
  [decision 22](docs/design/auth-design.md#22-auth-service-mints-every-machine-token)
  for `events:write` and `planner:advise`. Restating it here is how the two drifted apart once already.
- **Reset Agent** / **Restore Token** — the two `agent:reset` operations.
  Reset Agent registers a new agent with the **account token**; Restore Token
  stores a **game token** the operator supplies.
- **M2M token** (machine token) — the bearer token a **Machine** presents.
  Minted for it by auth-service with fixed scopes; valid 24 hours.
- **Token renewal** / **renewal point** — replacing a cached M2M token with a
  newly minted one before it expires. The renewal point is halfway through the
  token's lifetime, `iat + (exp - iat) / 2`; until a renewal lands, the cached
  token is still served.
  _Avoid_: refresh, refresh point (that is **Refresh**). Exempt code
  identifiers: `refreshAt` (`../auth-service/src/m2m/cache.ts`, `../auth-service/src/m2m/token.ts`),
  `refreshAtMs` (`../ts-introspection-client/src/m2mToken.ts`).
- **No credential** — what a request carries when its `Authorization` is not
  exactly one bearer token: no header, several header lines, or a value that is
  not `Bearer <token>`. Answered as a **Visitor**; the center is not asked.
- **Declaration** (route declaration) — what a route states it needs: no
  credential, a session, or a named scope. A route on a mutating method that
  declares it needs no credential is refused (**default-deny**); safe methods
  (`GET`, `HEAD`, `OPTIONS`) are exempt from default-deny only.
- **Game token** (agent token) — the SpaceTraders credential for the fleet's
  agent. Held by auth-service, injected by st-gateway. Never in the browser,
  never in any other service.
- **Account token** — the SpaceTraders credential that can register an agent
  after a universe reset. Held by auth-service only.
- **Universe reset** — SpaceTraders replacing its whole universe, which ends
  the agent and its game token. Observed as a change of the server's reset
  date, never forecast; auth-service then re-registers the agent.
  _Avoid_: wipe. Exempt code identifiers: `wipe_detected`, `WIPE_IMMINENT`,
  `WIPE_WINDOW_MS`, and the auth status states `HEALTHY` / `WIPE_IMMINENT` /
  `APP_TOKEN_EXPIRED` / `UNCONFIGURED`.

*The next three names are fixed by
[decision 21](docs/design/auth-design.md#21-one-verifier-every-service-asks-auth-service-what-a-token-carries),
decided 2026-09-20 and shipped in every service by 2026-09-29: no service
but auth-service verifies a token.*

- **The center** — auth-service in its second role: the one component that
  verifies a Clerk token, and the only one holding the Clerk public key.
  Distinct from the **vault**, its first role, which holds the game and
  account tokens. Same process, same port, different job.
- **Introspection** — a service asking the center whether a token is valid and
  what scopes it carries, instead of checking the signature itself. The
  contract and the exact answers are in
  [token-introspection.md](docs/design/token-introspection.md).
- **`kind`** — what the center says a verified caller is: `operator` or
  `machine`. It replaces reading the `sub` prefix, which only the center does.

## Traffic

- **Live fetch** — a call that reaches SpaceTraders (through st-gateway) rather
  than being answered from a cache or a local table.
- **Refresh** — an explicit request to discard a cached copy and live-fetch.
- **Priority** / **lane** — which of st-gateway's two queues a call waits in:
  `interactive` (the center answered: an active `operator`) or `background`
  (anything else: a machine, a visitor, an inactive token, or no answer from
  the center at all). Derived by the gateway from the center's answer; never
  declared by a caller, and never a reason to reject one.
- **Rate budget** — the one global allowance of SpaceTraders calls per second
  that every service's live fetches share, held by st-gateway. Both lanes draw
  on it; `interactive` is served first.
- **Credential mode** — what st-gateway puts on an upstream call: `none` for
  SpaceTraders' root (`GET /`), `forward` (the caller's own `Authorization`) for
  registering an agent (`POST /register`), `inject` (the **game token**) for
  everything else.
- **Calling service** — a backend that answers its own callers on answers it
  does not compute itself: it asks the center what a token carries, and reaches
  SpaceTraders through st-gateway. Distinct from the center and the gateway.

## Autopilot

- **Autopilot status** — `disarmed`, `armed`, `paused` or `aborted`. Armed is
  intent to run; pause finishes the current step, then idles; abort stops at
  once.
- **Autopilot mode** — `live` or `shadow`, chosen when arming. Switching between
  them always takes an explicit re-arm; a restart restores the status, always in
  shadow.
- **Shadow mode** — the planner scores and logs every would-be decision on the
  live schedule, but never writes task state and never dispatches.
- **Knob** — a bounded tunable (value, default, min, max) the planner or the
  anomaly checks read. Every knob has a class:
  - `model` — a claim about how the universe behaves; measured.
  - `policy` — a preference with no true value.
  - `alert` — a threshold that decides when something is wrong.

  The AI supervisor may write `policy` knobs only.
- **Reserve floor** — the credit balance the planner never spends past: work
  whose estimated cost would breach it is dropped, not scored against.
  _Avoid_: cash floor. No code identifier uses it.
- **Field** — an asteroid field: a mining target.
- **Cycle** — one round of a task, travel and work included; the planner
  prices every task as credits per cycle over cycle hours.
- **Observation** — a measurement taken from completed work (earnings per
  cycle, flight speed, overhead, fuel) that calibrates the planner's model.
  Observations decay with a half-life; a target never measured falls back to
  the fleet average or a prior.
- **Replan** — re-scoring every idle ship at once, on a knob write, a new
  anomaly, a manual request or a periodic fallback, all debounced together.
  Running work is never preempted.
- **Anomaly** — a finding of one of the periodic deterministic health checks
  (a ship idle, earnings stalled, repeated failures, a high error rate, stale
  prices, the game refusing the same call); recorded once and paged by
  webhook. Its thresholds are `alert` knobs.
- **Replay** — re-scoring decisions already logged under other knob values,
  offline, to count how many would have gone differently.
- **Scout** / **scouting** — a task that sends a ship to a market to update its
  prices, valued by how stale they are.
- **Market intel** — the fleet's cached knowledge of market prices, kept
  current by scouting.
