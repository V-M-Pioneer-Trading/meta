# Agent learnings

Curated by tech-lead at the end of each team run, merged by a human. Max 80 lines. Hard-to-reverse decisions go to docs/adr/, terms to `GLOSSARY.md`. This file holds the rest.

<!-- format: - **<warning|discovery|codebase>** (#<ticket> | adopted: <path>): <one line> -->

- **warning** (adopted: auth-service/README.md): never delete /data/auth.db on the host; it holds the only copy of the game token. Recovery is Restore Token or Reset Agent, with a human holding the account token.
- **warning** (adopted: meta/docs/design/auth-design.md): auth-service re-registers only on an observed `resetDate` change, never on the `serverResets.next` forecast, and reuses the stored call sign and email (`../auth-service/src/poller.ts:170-191`).
- **warning** (adopted: meta/docs/design/auth-design.md): scope auth-service's iptables rules to its /32, never the authnet subnet; the subnet rule caused two production outages on 2026-08-23.
- **warning** (adopted: meta/docs/design/auth-design.md): a Clerk allowlist admits nobody while the instance is `restricted`; bootstrap a zero-user instance by switching to `public`, signing in, then back to `restricted`.
- **warning** (adopted: automation-service/CHANGELOG.md): when granting an existing Clerk identity new scopes, ADD them to its `public_metadata` scopes; never replace the list.
- **warning** (adopted: meta/docs/design/auth-design.md): disabling an M2M caller only stops new mints; tokens already issued stay valid for up to 24 h.
- **warning** (adopted: meta/docs/design/auth-design.md): while auth-service is down every request that carries a token gets 503, public GETs included; only tokenless reads survive.
- **warning** (adopted: meta/docs/design/token-introspection.md): a non-2xx from the center (even its 401 about our secret) is 503 to the caller, never relayed as the user's 401.
- **warning** (adopted: meta/docs/design/token-introspection.md): `AUTH_INTROSPECTION_URL` is the full endpoint including /auth/v1/introspect; POST it verbatim, never append a path.
- **warning** (adopted: meta/docs/design/token-introspection.md): introspection is 1 s with no retries, but st-gateway's lane decision waits only 250 ms.
- **warning** (adopted: meta/docs/design/token-introspection.md): exactly one `Authorization` line counts, read from raw headers because Node drops duplicates; CloudFront collapses duplicate lines, so the multi-line rule is testable only from the host or authnet.
- **warning** (adopted: meta/docs/algorithms.md): every backend calling st-gateway relays the inbound `Authorization` unchanged; dropping it sends every call to the background lane, silently.
- **warning** (adopted: meta/docs/design/token-introspection.md): a conformance test asserts the exact message, identity and center call count; an empty answer passes anything weaker (meta#79).
- **warning** (adopted: fleet-service/README.md): a 401 never says why and a 403 never names the scope (no probing oracle); the wording lives in clerk-client, so services leave error messages as they are.
- **warning** (adopted: meta/docs/operations.md): CloudFront answers a missing backend route with `index.html` and 200; check the content type, not the status.
- **warning** (adopted: meta/docs/operations.md): the agent-service bootstrap document also runs st-gateway and MySQL, so an st-gateway deploy restarts agent-service's database too.
- **warning** (adopted: meta/docs/design/autopilot-spec.md): knob writes from the UI editor and ai-service are last-writer-wins, with no compare-and-set.
- **warning** (adopted: V-M-Pioneer-Trading_infrastructure/README.md): AWS CLI v1 treats an `https://` `--value` as a URL to fetch and stores the response; store the Telegram webhook URL with AWS CLI v2.
- **warning** (adopted: V-M-Pioneer-Trading_infrastructure/README.md): a failed Telegram `getUpdates` call leaves its URI, bot token included, in PowerShell `$Error`; run `$Error.Clear()` afterwards.
- **warning** (adopted: meta/docs/design/auth-design.md): a headless OAuth sign-up arrives as a `transferable` sign-in; the UI completes it (`../command-interface/src/components/operator/OperatorBadge.tsx:44-53`).
