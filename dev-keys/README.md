# Local development keypair

`dev-only-do-not-use.key.pem` is a **committed private key**. That is
deliberate, and it is safe, because nothing in production trusts it.

## Why this exists

auth-service verifies Clerk sessions for the whole backend, **networklessly** —
it holds a public key in `CLERK_JWT_KEY` and checks signatures itself, and
every other service asks it (auth-design decision 21). Local development
therefore needs *a* trust anchor, and there were three ways to provide one:

1. Require a Clerk account before `docker compose up` does anything.
2. Add an "auth optional in dev" flag.
3. Point the services at a throwaway keypair and mint tokens against it.

(2) is the one to refuse: a code path that turns authentication off is a
production vulnerability that passes CI, and it eventually ships enabled. (3)
keeps `git clone && docker compose up` working with no vendor account while
running the **exact** verification path production runs — same code, same
signature check, same scope check. Only the anchor differs, which is what a
trust anchor is for.

## Minting a token

```bash
node scripts/mint-dev-token.mjs
```

Prints an `Authorization` header value good for one hour carrying every scope the
backends know (`fleet:control`, `agent:reset`, `universe:refresh`).
No dependencies — it uses `node:crypto` only. To narrow it:

```bash
node scripts/mint-dev-token.mjs --scopes fleet:control --sub user_local --expires 300
```

Then:

```bash
curl -X POST http://localhost:3003/api/automation/v1/autopilot/abort -H "Authorization: $(node scripts/mint-dev-token.mjs)"
```

The minter is not the only thing that signs with the private half.
automation-service and ai-service are callers of other backends
(auth-design.md decisions 19 and 22), so each needs a machine identity of its
own rather than a human session. In production auth-service mints one per
caller from a Clerk Machine; locally auth-service signs it itself against this
same key, which `docker-compose.yml` bind-mounts into it as
`DEV_M2M_SIGNING_KEY_FILE`, and each caller fetches it from
`POST /auth/v1/m2m-token` with its dev caller secret. Same anchor, same
verification path at the receiving end, and still nothing production trusts.

## What this does *not* cover

The **frontend** is a different matter. command-interface uses Clerk's own SDK
to obtain a session, and that needs a Clerk **development instance** — free,
separate from production, and created in the Clerk dashboard. Set
`VITE_CLERK_PUBLISHABLE_KEY` and point auth-service's `CLERK_JWT_KEY` at that
instance's public key instead of this one.

So: this keypair covers backend development, integration poking and CI. Driving
the real UI locally needs a Clerk dev instance. There is deliberately no third
option where the browser fakes a session, for the same reason (2) was rejected.

CI does not use this keypair at all. auth-service generates an ephemeral pair
per test run and signs its own tokens; every other service's suite stubs
auth-service and signs nothing, so nothing has to be shared between
repositories.
