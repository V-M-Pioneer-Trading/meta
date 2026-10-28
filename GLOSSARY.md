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
  - `agent:reset` — register / restore the agent token. Irreversible and
    credential-bearing.
  - `universe:refresh` — force navigation-service to re-fetch universe data
    live. Spends the shared rate budget; moves nothing. Not implied by
    `fleet:control`.
  - `events:write` — append `ai_*` events to automation-service's event log.
  - `planner:advise` — write planner knobs and request a replan. A machine
    holding it may write policy knobs only.

  Which routes each one actually gates is in auth-design.md, not this list: the
  table in [decision 2](docs/design/auth-design.md#2-spacetraders-is-publicly-readable-and-privately-writable)
  for `fleet:control` and `agent:reset`, and
  [decision 20](docs/design/auth-design.md#20-universerefresh-a-third-scope-for-spending-the-rate-budget-without-moving-the-fleet)
  for `universe:refresh`. Restating it here is how the two drifted apart once already.
- **Game token** (agent token) — the SpaceTraders credential for the fleet's
  agent. Held by auth-service, injected by st-gateway. Never in the browser,
  never in any other service.
- **Account token** — the SpaceTraders credential that can register an agent
  after a universe reset. Held by auth-service only.
- **Universe reset** — SpaceTraders deleting every agent at once; afterwards
  the fleet's agent must be registered again. _Avoid_: wipe, and bare "reset"
  (Reset Agent is the operator action that re-registers).
- **Machine token** — the Clerk token a machine presents, minted for it by the
  center. _Avoid_: M2M secret.
- **Caller identity secret** — the per-machine secret a machine shows the
  center to have its machine token minted.
- **Scope declaration** — a route's stated credential requirement. A route
  without one is undeclared: its service refuses to start, or answers `500`.

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
- **Rate budget** — the one SpaceTraders request allowance st-gateway shares
  across every caller. _Avoid_: rate limit (that is SpaceTraders' own).
- **Relay** — passing st-gateway's failure answer on unchanged: its status,
  message and pacing headers.
- **Pacing headers** — `Retry-After` and `X-RateLimit-*`, relayed with any
  error answer.
- **Verdict** — how a failed upstream call is classified: `rejected`,
  `malformed`, `internal`, `unavailable`, `credentials` or `denied`.

## Autopilot

- **Autopilot** — automation-service's engine: it assigns each ship a task and
  drives it. _Avoid_: bot, automation.
- **Status** — the autopilot's lifecycle state: `disarmed`, `armed`, `paused`
  or `aborted`. An operator arms, pauses or aborts it.
- **Mode** — `live` dispatches game actions; `shadow` scores and logs every
  decision but dispatches nothing. A restart always comes back in shadow.
  _Avoid_: dry-run.
- **Task** — one ship's current assignment: a mining, contract or scout task.
- **Scout** — the task that visits a market to refresh its prices for the
  other tasks. _Avoid_: market intel.
- **Tick** — one scheduler pass, in which every ship advances one action.
- **Cycle** — one full round of a task, e.g. for mining: fly out, extract,
  sell, return. A task's score is its credits per cycle over its cycle hours.
- **Credits per hour** — the planner's single scoring unit.
- **Replan** — re-scoring the candidates and reassigning tasks.
- **Knob** — a named, bounded planner parameter, of class `model`, `policy` or
  `alert`. A **policy knob** is the only class a machine may write.
- **Credit floor** — the credit balance the planner never spends below.
  _Avoid_: reserve floor, cash floor.
- **Observation** — a measured result of one cycle, which the planner scores
  on. A **prior** is the configured value it falls back on until observations
  exist.
- **Anomaly** — a detected deviation from expected fleet behaviour. A
  **digest** summarises the anomalies in a time window.
- **Anomaly check** — one detector that can raise an anomaly. _Avoid_: health
  check (that is a service's `/health`).
- **Anomaly report** — an anomaly sent out to the webhook, e.g. to Telegram.
  _Avoid_: page, delivery.
- **Supervisor** — ai-service's loop: it answers anomalies by writing policy
  knobs and requesting a replan, and never drives a ship.
- **Delivery** — cargo handed to a contract in the game. agent-service's
  history row of one is a **delivery record**.

## Records and tests

- **Transaction** — agent-service's history row of one trade: a ship
  purchase, a cargo purchase or a sale.
- **Contract suite** — the black-box parity tests in agent-service's and
  auth-service's `contract/`. Not a game **contract**.
- **Conformance fixture** — a fixture file in meta that every client vendors
  byte for byte and tests against.
