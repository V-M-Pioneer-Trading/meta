# What a service answers when it cannot verify a token itself

*Status: **decided 2026-09-20, not shipped.** Nothing here describes how any
service behaves today — today every service verifies Clerk tokens locally
against `CLERK_JWT_KEY`. This document and
[`fixtures/introspection.json`](../../fixtures/introspection.json) are step 1 of
[meta#80](https://github.com/V-M-Pioneer-Trading/meta/issues/80); the rest of
its eleven steps are what will make it true, one service at a time. Read it as
a specification, not as a description. The decision itself is
[auth-design.md decision 21](auth-design.md#21-one-verifier-every-service-asks-auth-service-what-a-token-carries),
which supersedes decision 4.*

Normative for every service that receives an `Authorization` header:
agent-service, fleet-service, navigation-service, automation-service,
st-gateway, and auth-service's own two vault routes.

## The rule

**auth-service decided whether the token is valid and what it carries. Ask it,
and decide only what your own route needs.** A calling service classifies
nothing about the token itself: not its signature, not its expiry, not its
issuer, not whether `sub` looks like a person. It sends the bytes it received
to `POST /auth/v1/introspect` and acts on the answer.

| Situation | Status | Message | Center called |
|---|---|---|---|
| No `Authorization`, route declares nothing and is a `GET` | — | proceeds as a visitor | **no** |
| No `Authorization`, route declares a scope or a session | **401** | `a bearer token is required` | **no** |
| A header that is not `Bearer <something>` | **401** | `a bearer token is required` | **no** |
| Non-`GET` route declaring no scope | **403** | `this action requires a scope this session does not carry` | **no** |
| `{"active": false}` | **401** | `invalid or expired session` | yes |
| Active, route's scope missing | **403** | `this action requires a scope this session does not carry` | yes |
| Active, route's scope present | — | proceeds with `{sub, kind, scopes}` | yes |
| Center unreachable, timed out, non-2xx, malformed, or rejecting our secret | **503** | `the authentication service did not answer, so this request cannot be authorized` | yes |

Every body uses the family's `{"error":{"message":…}}` envelope. The first
three messages are the ones four services answer with today and are preserved
byte for byte; the `503` sentence is new.

**Three rules are worth stating on their own, because each one is a mistake
someone will otherwise make:**

- **A bad credential is never downgraded to a visitor.** A missing header is
  anonymous; a presented token that does not verify is a 401 on every method,
  including a `GET` that would have been served anonymously. Downgrading hides
  an expired session from the operator holding it and hides a misconfigured
  trust anchor from everyone.
- **Default-deny on mutating methods.** A non-`GET` route that declares no
  scope is rejected, not served. This is the part that makes
  [meta#71](https://github.com/V-M-Pioneer-Trading/meta/issues/71) —
  an unauthenticated `POST` nobody remembered to guard — structurally
  impossible rather than merely unlikely, and it is why the middleware is
  global rather than a decoration applied route by route.
- **The center's `401` is about us, not about the caller.** It means our
  introspection secret is wrong, missing or rotated. Relaying it as a `401`
  tells an operator to sign in again, forever, against a service that cannot
  accept them. It is a `503`.

## Why asking, rather than each service verifying

Because six copies of the same verification produced six slightly different
answers, and two unguarded routes.

| | agent-service (Go) | auth-service (Go) | fleet-service (TS) | automation-service (TS) | navigation-service (Java) | st-gateway (TS) |
|---|---|---|---|---|---|---|
| library | `golang-jwt` | `golang-jwt` | `jose` v5 | `jose` v5 | `nimbus-jose-jwt` | `jose` v5 |
| missing scope | generic sentence | generic sentence | generic sentence | **names the scope** | generic sentence | n/a |
| records an actor | no | no | no | `res.locals.actor` | no | n/a |
| knows `user_`/`mch_` | no | no | no | no | no | **yes** |
| unguarded routes | `POST …/deliveries` (meta#71) | — | — | — | refresh routes until 2026-09-05 | n/a |

None of those differences was wrong in its own repository. That is the
problem: a verifier ported by hand into five languages has five maintainers and
no single place a fix lands. The drift is tracked as
[meta#74](https://github.com/V-M-Pioneer-Trading/meta/issues/74) and the
unguarded write as meta#71, and both close with decision 21.

The cost is stated plainly in decision 21 and not softened here: a localhost
hop on the hot path of every authenticated request, and a fail-closed single
point of failure. Those were decision 4's objections and they are accepted, not
answered. The trade is that a verification bug now has one place to be fixed,
and a route that forgets its guard is refused instead of served.

## What a client decides for itself

Three things, and no more.

- **Which routes declare which scope.** The center keeps no route-to-scope
  table and never will; it answers what a token says, not what a route needs.
  A service that wanted the center to decide would be handing it a copy of its
  own route table to drift against, which is the failure this document exists
  to end.
- **What to do with `{sub, kind, scopes}` past the guard.** navigation-service
  uses it for the live-fetch rule
  ([decision 3](auth-design.md#3-live-anonymous-reads-are-allowed-where-a-visitor-cannot-expand-them));
  automation-service writes `detail.actor` and fences knob classes on
  `kind === "machine"`; the others use none of it. That is a judgement about
  what each service does with an identity, not about how the identity was
  established.
- **Whether a `GET` is public at all.** Most are
  ([decision 2](auth-design.md#2-spacetraders-is-publicly-readable-and-privately-writable));
  agent-service's live reads are not
  ([decision 18](auth-design.md#18-increment-2s-transition-window-a-second-header-and-a-narrower-promise)).
  The tiers are unchanged by decision 21.

**st-gateway decides one more thing, and differently: a lane, never a
verdict.** It does not authorize — that already happened in the calling service
— so it never rejects, and anything other than an active `operator` is
`background`, including a center that does not answer. A gateway that failed
closed on the center would take the public read surface down with auth-service.
Its cases are a separate, clearly marked group in the fixture for exactly that
reason.

## Conformance

[`fixtures/introspection.json`](../../fixtures/introspection.json) is the
source of truth: seventeen conditions for a calling service, plus seven for
st-gateway's lane policy, each with the center response that produces it and
the answer expected. It also fixes the names three implementations have to
agree on — the endpoint, the form field, the `X-Introspection-Secret` header,
`AUTH_INTROSPECTION_URL` and `AUTH_INTROSPECTION_SECRET`, the 1 s timeout and
the zero retries.

Each implementation **vendors that file verbatim** into its test support
directory and drives its own client through every case, with a header on the
copy naming this file as the original. Vendored rather than imported because
these are three languages in three repositories: a copied data file makes drift
visible in a diff, which a prose specification does not. Change `meta` first,
then re-copy. Unknown assertion keys must fail the case rather than be skipped,
so a copy that falls behind says so instead of quietly checking less.

**The suite stands up a stub center, and stops signing tokens.** That is the
practical change for five repositories: no ephemeral keypair, no `jose` or
`golang-jwt` or `nimbus-jose-jwt` in the test tree either, and the token
strings in the fixture are deliberately not valid JWTs — a client that looks
inside one fails. Real signatures are checked in exactly one place, in
auth-service's own tests, where
[decision 10](auth-design.md#10-verification-is-networkless-and-local-development-uses-its-own-keypair)'s
networkless verification and its no-bypass rule apply unchanged.

**A case must not be satisfiable by an empty or trivial answer.** This is
[meta#79](https://github.com/V-M-Pioneer-Trading/meta/pull/79)'s lesson, learned
on the gateway fixture: `oversized-error-body` asserted a status and a maximum
length, which an empty message meets perfectly, and a client that had dropped
the message entirely passed it. So every rejection here asserts its **exact**
message; the two that could be satisfied by leaking detail also assert what the
message must **not** contain; every success asserts the **identity** handed to
the handler rather than merely a 2xx; and every case asserts **how many times
the center was called**, so that `0` and `1` are both real assertions and a
helpful retry loop fails.

Local additions belong in the service's own tests. This file holds only
conditions every implementation must answer identically.

## What this deliberately does not standardise

- **The shape of the middleware.** Express middleware, a `mux` wrapper and a
  servlet filter are not going to be the same thing, and nothing is gained by
  pretending. What is fixed is the answer, the request to the center and the
  call count — everything the fixture can observe from outside.
- **How the TS package ships its build.** One package, consumed by git tag by
  fleet-service, automation-service and st-gateway, because GitHub Packages
  demands a token even for public packages and that breaks the Docker builds.
  Whether the built output is a committed `dist` or a `prepare` script is
  decided when the repository is created.
- **Any numeric error code.** [upstream-errors.md](upstream-errors.md) excludes
  one on purpose and this follows it, for the same reason: it cannot be relayed
  as a field through agent-service's plain-text errors or navigation-service's
  `ProblemDetail`, so promising it here would promise an envelope change
  neither document is making. The consequence to be explicit about is that
  automation-service's failure classifier keys on the sentence — it must map
  this `503` to *upstream unavailable*, and it must not confuse it with
  st-gateway's `SpaceTraders credential not configured`, which is the one
  message meaning an operator has to act.
- **Caching an introspection result.** There is none, deliberately, and this is
  a prohibition rather than an omission: a cache is a second verification path
  with a different answer, and it makes revocation mean nothing for its
  lifetime.
- **What the center does internally.** Leeway, issuer checking, the decision
  not to check `azp`, and which library verifies are decision 21's business and
  the center's. A client cannot observe any of them, which is the point.
