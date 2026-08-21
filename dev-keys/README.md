# Local development keypair

`dev-only-do-not-use.key.pem` is a **committed private key**. That is
deliberate, and it is safe, because nothing in production trusts it.

## Why this exists

Every backend service verifies Clerk sessions **networklessly** — it holds a
public key in `CLERK_JWT_KEY` and checks signatures itself. Local development
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

Prints an `Authorization` header value good for one hour carrying both scopes.
No dependencies — it uses `node:crypto` only. To narrow it:

```bash
node scripts/mint-dev-token.mjs --scopes fleet:control --sub user_local --expires 300
```

Then:

```bash
curl -X POST http://localhost:3003/api/automation/v1/autopilot/abort -H "Authorization: $(node scripts/mint-dev-token.mjs)"
```

## What this does *not* cover

The **frontend** is a different matter. command-interface uses Clerk's own SDK
to obtain a session, and that needs a Clerk **development instance** — free,
separate from production, and created in the Clerk dashboard. Set
`VITE_CLERK_PUBLISHABLE_KEY` and point the backends' `CLERK_JWT_KEY` at that
instance's public key instead of this one.

So: this keypair covers backend development, integration poking and CI. Driving
the real UI locally needs a Clerk dev instance. There is deliberately no third
option where the browser fakes a session, for the same reason (2) was rejected.

CI does not use this keypair at all — each service generates an ephemeral pair
per test run and signs its own tokens, so nothing has to be shared between
repositories.
