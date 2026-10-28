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
  - `events:write` — post `ai_` events to automation-service's event log.
  - `planner:advise` — change automation-service's policy knobs and trigger a
    replan.

  Which routes each one actually gates is in auth-design.md, not this list: the
  table in [decision 2](docs/design/auth-design.md#2-spacetraders-is-publicly-readable-and-privately-writable)
  for `fleet:control` and `agent:reset`, and
  [decision 20](docs/design/auth-design.md#20-universerefresh-a-third-scope-for-spending-the-rate-budget-without-moving-the-fleet)
  for `universe:refresh`, and
  [decision 22](docs/design/auth-design.md#22-auth-service-mints-every-machine-token)
  for `events:write` and `planner:advise`. Restating it here is how the two drifted apart once already.
- **Game token** (agent token) — the SpaceTraders credential for the fleet's
  agent. Held by auth-service, injected by st-gateway. Never in the browser,
  never in any other service.
- **Account token** — the SpaceTraders credential that can register an agent
  after a universe reset. Held by auth-service only.

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
- **Credential mode** — what st-gateway does with credentials on one call,
  chosen from method and path: `none` (no token, `GET /`), `forward` (the
  caller's `Authorization`, `POST /register` only) or `inject` (the game
  token, everything else).

## Machine credentials and access

- **Access declaration** — the statement every route makes, at registration,
  of what a caller must present: public, ignore credentials, a session, or a
  scope. A route without one refuses to start (clerk-client `secured()`,
  navigation-service `DeclarationAudit`).
- **Caller secret** — the per-machine secret a machine sends as
  `X-M2M-Caller-Secret` to auth-service's `POST /auth/v1/m2m-token`. It is the
  machine's identity there; an unset secret disables that caller.
- **M2M token** — the Clerk token auth-service mints for a machine
  ([decision 22](docs/design/auth-design.md#22-auth-service-mints-every-machine-token)):
  24 h lifetime, refreshed at half-life.
  _Avoid_: machine token
- **Clerk machine credential** — the Clerk Machine Secret Key of one machine.
  Only auth-service holds it, to mint M2M tokens.
  _Avoid_: machine key, Machine Secret Key (identifiers `M2M_MACHINE_KEY_*`,
  `m2m_machine_key_*` keep their names)
- **Universe reset** — SpaceTraders discarding every agent at once. The
  root's `resetDate` predicts it; auth-service reports `WIPE_IMMINENT` within
  24 h of it.
  _Avoid_: wipe (the identifier `WIPE_IMMINENT` keeps its name)
- **Restore Token** / **Reset Agent** — the two operator actions on
  auth-service (scope `agent:reset`). Restore Token replaces the agent token of
  the agent already registered, with no upstream call. Reset Agent registers a
  new agent with the account token, after a universe reset.

## Autopilot

- **Credit-changing action** — any call that spends or earns credits: ship or
  cargo purchase, sell, refuel, contract accept, deliver, fulfil.
- **Knob** — a named, bounded planner parameter in automation-service. Its
  class is `model`, `policy` or `alert`; a machine may write `policy` knobs
  only.
- **Autopilot state** — `disarmed`, `armed`, `paused` or `aborted`, each with a
  mode, `live` or `shadow`.
- **Shadow** — the autopilot armed in mode `shadow`: it scores and logs every
  tick but never dispatches a ship or accepts a contract. A restart always
  comes back in shadow.
- **Replan** — automation-service re-scoring idle ships, triggered by a knob
  change, an anomaly, an operator, or the interval.
- **Anomaly** — a persisted health finding raised by one of
  automation-service's checks, optionally delivered to a webhook.
- **Anomaly digest** — the summary of anomalies over a time window, which
  ai-service reads.

## Operations

- **Bootstrap document** — the SSM document `<svc>-bootstrap-<instance>` that
  pulls a service's image and (re)starts its container on the host. A service
  deploy re-runs it; any change to it re-runs on apply.
