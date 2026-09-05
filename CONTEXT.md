# Domain glossary

The names this system uses for things, so code, docs and conversation agree.
Design decisions themselves live in `docs/design/*-design.md` as numbered
decisions; this file only fixes vocabulary.

## Identity and credentials

- **Operator** — a human signed in with Clerk from the dashboard. Carries a
  **session** whose `scope` claim lists their permissions.
- **Machine** — a non-human caller with its own Clerk identity
  (automation-service). Its token's `sub` starts `mch_`; an operator's starts
  `user_`. st-gateway uses that distinction to pick a queue.
- **Visitor** — anyone with no session. May read what a backend serves
  anonymously; may not cause a live upstream call except where a backend
  explicitly allows it.
- **Scope** — a permission literal in the session token. Three exist:
  - `fleet:control` — arm, pause, abort, replan, knob writes, ship actions,
    purchases and sells. Reversible, but moves credits and ships.
  - `agent:reset` — register / restore the agent token. Irreversible and
    credential-bearing.
  - `universe:refresh` — force navigation-service to re-fetch universe data
    live. Spends the shared rate budget; moves nothing. Not implied by
    `fleet:control`.
- **Game token** (agent token) — the SpaceTraders credential for the fleet's
  agent. Held by auth-service, injected by st-gateway. Never in the browser,
  never in any other service.
- **Account token** — the SpaceTraders credential that can register an agent
  after a universe reset. Held by auth-service only.

## Traffic

- **Live fetch** — a call that reaches SpaceTraders (through st-gateway) rather
  than being answered from a cache or a local table.
- **Refresh** — an explicit request to discard a cached copy and live-fetch.
- **Priority** / **lane** — which of st-gateway's two queues a call waits in:
  `interactive` (an operator's session) or `background` (a machine, a visitor,
  or anything that failed verification). Derived by the gateway; never
  declared by a caller.
