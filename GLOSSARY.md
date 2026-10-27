# Domain glossary

The names this system uses for things, so code, docs and conversation agree.
Design decisions themselves live in `docs/design/*-design.md` as numbered
decisions; this file only fixes vocabulary.

## Identity and credentials

- **Operator** — a human signed in with Clerk from the dashboard. Carries a
  **session** whose `scope` claim lists their permissions.
- **Machine** — a non-human caller with its own Clerk identity
  (automation-service, ai-service). Its token's `sub` starts `mch_`; an operator's starts
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
  - `events:write` — append `ai_` audit rows to automation-service's event
    log. Held by the ai-service machine and the operator.
  - `planner:advise` — write knobs and request replans. Same holders as
    `events:write`; neither is implied by `fleet:control`. What fences a
    machine to `policy` knobs is `kind`, not this scope.

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
- **Vault** — auth-service in its first role: the store of the game token and
  the account token. See **the center** for its second role.
- **Universe reset** — SpaceTraders wiping every agent on its own schedule,
  seen as a new `resetDate`. Recovered by registering a new agent with the
  account token. _Avoid_: wipe (it survives only in state names such as
  `WIPE_IMMINENT`).
- **M2M token** — a short-lived token the center mints for a machine, which
  presents its **caller secret** to get one. Carries the machine's fixed scopes
  ([decision 22](docs/design/auth-design.md)). _Avoid_: machine token.

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
