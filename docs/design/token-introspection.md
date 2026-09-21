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
| Route on a **mutating** method declaring no scope | **500** | `this route declares no required scope` | **no** |
| No `Authorization`, route declares nothing and the method is **safe** | — | proceeds as a visitor | **no** |
| No `Authorization`, route declares a scope or a session | **401** | `a bearer token is required` | **no** |
| A header that is not `Bearer <something>` | **401** | `a bearer token is required` | **no** |
| `{"active": false}` | **401** | `invalid or expired session` | yes |
| Active, route's scope missing | **403** | `this action requires a scope this session does not carry` | yes |
| Active, route's scope present | — | proceeds with `{sub, kind, scopes}` | yes |
| Center unreachable, timed out, non-2xx, malformed, or rejecting our secret | **503** | `the authentication service could not process this request` | yes |

The rows are in evaluation order: the first is decided before the
`Authorization` header is read, which is why it is first. Every body uses the
family's `{"error":{"message":…}}` envelope. The `401` and `403` messages are
the ones four services answer with today and are preserved byte for byte; the
`500` and `503` sentences are new, both fixed by the owner on 2026-09-20.

**Three rules are worth stating on their own, because each one is a mistake
someone will otherwise make:**

- **A bad credential is never downgraded to a visitor.** A missing header is
  anonymous; a presented token that does not verify is a 401 on every method,
  including a `GET` that would have been served anonymously. Downgrading hides
  an expired session from the operator holding it and hides a misconfigured
  trust anchor from everyone.
- **Default-deny on mutating methods, and it is a `500`.** A route on a
  mutating method that declares no scope is refused, not served — mutating
  meaning anything other than the safe methods `GET`, `HEAD` and `OPTIONS`.
  This is the part that makes
  [meta#71](https://github.com/V-M-Pioneer-Trading/meta/issues/71) —
  an unauthenticated `POST` nobody remembered to guard — structurally
  impossible rather than merely unlikely, and it is why the middleware is
  global rather than a decoration applied route by route. **Not a `403`**: the
  caller has done nothing wrong and can do nothing about it, and
  automation-service maps a `403` to a terminal `credentials` verdict, so a
  `403` would abandon a target and send the operator to check Clerk scopes for
  a defect in our routing table. The rule is applied **before** the header is
  read, so a valid token, an expired one and no token at all all get the same
  answer.
- **The center's `401` is about us, not about the caller.** It means our
  introspection secret is wrong, missing or rotated. Relaying it as a `401`
  tells an operator to sign in again, forever, against a service that cannot
  accept them. It is a `503` — and so is a center that answers `500`, or
  answers a body we cannot parse. The sentence says *could not process* rather
  than anything about answering precisely because three of the five conditions
  it covers are answers. It must also stay distinct from st-gateway's
  `SpaceTraders credential not configured`, which is the one `503` sentence
  automation-service's classifier treats as "an operator must act".

**Default-deny applies to mutating methods only. `GET`, `HEAD` and `OPTIONS`
are safe methods (RFC 9110 §9.2.1) and are exempt** (owner's delegate,
2026-09-21). The rule as first written said "non-`GET`", which swept in two
methods that change nothing:

- **`HEAD` is the same route as `GET`.** Express dispatches a `HEAD` to the
  `GET` handler, so a requirement declared for `GET /x` governs `HEAD /x` too,
  and an adapter must resolve it that way — a resolver keyed on `"GET /path"`
  has to be consulted for a `HEAD` of that path. Exempting `HEAD` from
  default-deny is **not** exempting it from a requirement the route did
  declare: `HEAD` on a guarded route with no credential is the same `401` as
  `GET`. Getting that half wrong hands out a credential-free read of a guarded
  route's headers, which leak existence, sizes and `ETag`s.
- **`OPTIONS` with no declared requirement proceeds as `none`.** A CORS
  preflight carries no `Authorization` header by definition — the browser
  strips it — so answering `500` breaks every cross-origin call from the
  dashboard before the real request is sent, and reads as a server fault rather
  than a policy one.

Method comparison is case-insensitive. Scope comparison is **not**: scopes are
matched by exact membership of the split list, never by prefix, namespace walk,
substring or case-folding.

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
source of truth: thirty-one conditions for a calling service, plus ten for
st-gateway's lane policy — forty-one in all — each with the center response
that produces it and the answer expected. It also fixes the names three
implementations have to agree on — the endpoint, the form field, the
`X-Introspection-Secret` header, `AUTH_INTROSPECTION_URL` and
`AUTH_INTROSPECTION_SECRET`, the 1 s timeout and the zero retries.

**The fixture is versioned, and `version` is now `2`** (owner's delegate,
2026-09-21). Version 2 adds the seven calling-service cases and the one gateway
case that pin the safe-method rule, exact scope matching and what is not a
bearer token; it changes no existing case and removes none. auth-service's own
vendored copy pins **version 1**, at meta commit `358231f`, and is re-vendored
at **step 11** of [meta#80](https://github.com/V-M-Pioneer-Trading/meta/issues/80);
it stays valid in the meantime because version 2 only adds cases a *client*
answers, and auth-service is the center. A copy is allowed to lag the original;
it is never allowed to lead it.

**`AUTH_INTROSPECTION_URL` is the full endpoint URL, `/auth/v1/introspect`
included, and a client POSTs to it verbatim.** In production it is
`http://localhost:3005/auth/v1/introspect` for the four `--network host`
services and `http://auth-service:3005/auth/v1/introspect` for st-gateway,
which is on `authnet`; locally it is the compose equivalent. A client must
never append a path, join a suffix, or otherwise take it apart — RFC 7662 calls
this the *introspection endpoint*, and an endpoint URL is a whole address. The
fixture's `contract.endpoint.path` is there to pin **the route auth-service
serves**, so the center and its three client implementations agree on one
spelling; it is not a suffix a caller adds to a base URL. A base-URL form was
considered and rejected: it would put the same literal in three languages to
drift against, which is the failure this document exists to end. (Owner's
delegate, 2026-09-21, settling it for
[infrastructure#86](https://github.com/V-M-Pioneer-Trading/infrastructure/pull/86)'s
`auth_introspection_url` output, whose description now says the same.)

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

**Rule order is tested, not assumed.** The scopeless mutating route appears
three times — with a valid token, with an inactive one, and with no header at
all — because the rule is only right if it is applied first. A client that
reads the header first answers `401` for the third and introspects for the
second, and both look reasonable until an operator is sent to check their
Clerk scopes over a routing-table defect.

**Three more cases exist because every other case agrees with itself.** A
fixture whose data is always internally consistent cannot catch a client that
computes an answer it was given.

- **`kind` is the center's answer, never re-derived.** Two cases (one per
  group) report a `user_` subject as `machine`, and one reports the mirror.
  That pairing is impossible in production — the center computes `kind` from
  the subject prefix — and exists only to pin who owns the rule. Without it, a
  client that kept `sub.startsWith("user_")`, which is precisely what
  st-gateway does today, passes every other case unchanged.
- **The session tier is a tier.** Three cases cover a route that requires a
  verified session and no particular scope: no header, an inactive token, and
  an active token carrying **no scopes at all**, which must be allowed. A
  client that folds this tier into "public" passes the first two only by
  accident; one that folds it into "any scope" fails the third.
- **`scope` is split on whitespace runs.** One case carries a double space, a
  tab and a trailing space, matching what all five verifiers do today
  (`strings.Fields`, `/\s+/`, `\\s+`). A client splitting on a single space
  literal cannot find the required scope at all.

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
