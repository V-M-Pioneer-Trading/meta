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

*Dated 2026-09-29: shipped. Every service that receives an `Authorization`
header now behaves as this document says, and no service but auth-service
verifies a token. The status above is kept as written; read the rest as a
description, with the dated notes below marking where practice and text part.*

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
  caller has done nothing wrong and can do nothing about
  it. automation-service reads a sibling's `403` carrying this document's
  scope sentence as a `credentials` verdict and any other `403` as the game's
  `denied` (automation-service#30), so a `403` would either send the operator
  to check Clerk scopes or blame the game for a defect in our routing table,
  and either way spend the ship's slow plumbing budget. The rule is applied
  **before** the header is read, so a valid token, an expired one and no
  token at all all get the same answer.
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

Method comparison is case-insensitive, and so is the bearer **scheme** token
(RFC 7235 makes it so; `bearer abc` is a credential). Scope comparison is
**not**: scopes are matched by exact membership of the split list, never by
prefix, namespace walk, substring or case-folding.

### What is a bearer token, and what is not

An `Authorization` header is a credential only when it is **exactly the scheme
plus one `token68`** — two whitespace-separated parts and no more. Everything
else reads as *no credential at all* and answers `401 a bearer token is
required` **without calling the center**:

- `"Bearer"` and `"Bearer "` carry no token. An empty token is not a token to
  ask about; forwarding it POSTs `token=` and spends a round trip on the way to
  the same answer.
- `"Bearer abc def"` is **not** the token `abcdef` and not the token `abc def`.
  A header is never concatenated, and never split-with-a-limit so the remainder
  survives intact. Repairing it invents a credential nobody issued.
- **More than one `Authorization` line, whatever the lines hold, is no
  credential**, and the center is not called. The count comes from the **raw
  header list** — the lines as they arrived, before any framework has merged
  them — and there are two ways to miss it. *Join-then-count*: Go's
  `Header.Values` and Tomcat's `getHeaders` keep every line, and a client
  that joins them with `", "` and counts parts reads `Bearer a` plus an
  **empty** second line as `"Bearer a, "`, which is two parts, and asks the
  center about the token `a,` that nobody sent. *A parser that drops
  duplicates*: Node's HTTP parser discards repeated `authorization` lines and
  keeps the first, so `req.headers.authorization` shows one well-formed
  credential and only `req.rawHeaders` shows two arrived. An empty line is
  still a line. Picking one lets a caller choose which of two credentials a
  proxy sees a service verify.

  *Dated 2026-09-26.* This bullet first said that two headers "which Express
  and most servers join into `"Bearer a, Bearer b"`" are four parts and read
  as none. That was wrong on both counts — Express never sees a joined value,
  and a join can come out as two parts — and three implementations were found
  getting the count wrong in one week. A runtime review of
  [navigation-service#22](https://github.com/V-M-Pioneer-Trading/navigation-service/pull/22)
  found its Java client joining Tomcat's `getHeaders` and introspecting `a,`
  for `Bearer a` plus an empty line; agent-service's Go client did the same
  with `Header.Values`, fixed in
  [agent-service#27](https://github.com/V-M-Pioneer-Trading/agent-service/pull/27).
  ts-introspection-client 1.1.1 never sees the second line at all: on a raw
  socket, `Bearer a` + `Bearer b` reached Express as `"Bearer a"` and the
  center was asked about `a`, and an empty line + `Bearer b` reached it as
  `""` and was served as a visitor. Fixture version 4 pins the count.

  *Dated 2026-09-29.* From the internet this rule is never exercised.
  CloudFront collapses duplicate `Authorization` lines into one before the
  request reaches the host, so two lines sent to the public domain arrive as
  one credential and are introspected as one. Verified against fleet-service:
  the same two lines answered `401 invalid or expired session` through
  CloudFront and `401 a bearer token is required` sent to the host directly.
  The count is exercised only by a caller on the host or on `authnet`, so a
  check of it has to be run from there; a request through the distribution
  cannot fail it.
- A non-bearer scheme — `Basic …` — is not forwarded either.

**This rule is a SPECIFICATION, not a description of what the fleet does
today** (dated 2026-09-21). At the time of writing, four of the six verifiers
break it, and they break it in two different ways:

| Service | Extraction today | `"Bearer abc def"` becomes | Conforms? |
|---|---|---|---|
| fleet-service | `header.trim().split(/\s+/)`, then `rest.join("")` | the token `abcdef` | **no** |
| automation-service | same | the token `abcdef` | **no** |
| st-gateway | same | the token `abcdef` | **no** |
| navigation-service | `header.trim().split("\\s+", 2)` | the token `abc def` | **no** |
| agent-service | `strings.Fields`, rejects `len != 2` | no credential | yes |
| auth-service | `strings.Fields`, rejects `len != 2` | no credential | yes |

The four non-conforming ones forward the invented token into verification and
answer `invalid or expired session` **after** the work, rather than
`a bearer token is required` before it. Under decision 21 that "work" becomes a
network call to the center, which is the part that matters: a malformed header
is the cheapest thing an anonymous flood can send, and the difference between
zero calls and one is the difference between a policy answer and an auth
outage's `503`.

Nothing is being fixed here. The four conform when they migrate — **step 5**
(fleet-service), **step 7** (navigation-service), **step 8**
(automation-service) and **step 9** (st-gateway) of
[meta#80](https://github.com/V-M-Pioneer-Trading/meta/issues/80) — because each
deletes its own extraction and takes the shared client's. Recorded so that a
reader comparing this document against a running service finds a scheduled
divergence rather than a lie. The fixture pins it from the client side:
`bearer-with-empty-token`, `bearer-with-internal-whitespace`,
`gateway-bearer-with-empty-token` and, for the scheme's case-insensitivity,
`lowercase-bearer-scheme`.

*Dated 2026-09-29.* All four migrated as scheduled, and the table above is now
historical: no row of it describes a running service. fleet-service,
automation-service and st-gateway now extract through ts-introspection-client,
and navigation-service through its Java client, each driven by fixture
version 4.

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
source of truth: fifty-six conditions for a calling service, plus nineteen for
st-gateway's lane policy — seventy-five in all — each with the center response
that produces it and the answer expected. It also fixes the names three
implementations have to agree on — the endpoint, the form field, the
`X-Introspection-Secret` header, `AUTH_INTROSPECTION_URL` and
`AUTH_INTROSPECTION_SECRET`, the 1 s timeout and the zero retries.

**The fixture is versioned, and `version` is now `7`.** Version 7
(2026-10-05, owner's decision Q30,
[clerk-client#13](https://github.com/V-M-Pioneer-Trading/clerk-client/issues/13))
adds five calling-service cases and five gateway cases and changes none. It
pins one rule: **a non-2xx answer is unavailable whatever its body says.** The
center answers `500`, `401`, `302`, `503` or `404` with a body that is a
valid active answer for an operator holding the required scope. A calling
service answers `503 the authentication service could not process this
request`, st-gateway lanes `background`, and the center is called once. The
status is decided before the body is read; the body of a non-2xx is never
parsed for an identity. Every non-2xx case before version 7 carried an error
body that no reader takes for an answer, so a client that parsed first and
looked at the status only when the parse failed passed the whole file.
clerk-client (`if (!response.ok)` ahead of the body read) and
navigation-service (`IntrospectionClient` checks the status, and its body
subscriber does not even read a non-2xx body) already behaved this way; the
cases pin it. A `3xx` is never followed, since following it would carry the
caller secret to the `Location`'s host. The stub sends no `Location`, so
not following a redirect stays each client's own obligation to test. The
center never sends an active body with a non-2xx, so these cases are a
client's obligation only, and auth-service's center test classifies them as
client-only. `scripts/validate-fixtures.mjs` now refuses a case that stubs a
non-2xx and expects anything but `centerUnavailable` or `background`. New
cases: `center-returns-{500,401,302,503,404}-with-active-body` and
`gateway-center-returns-{500,401,302,503,404}-with-active-body`.

Re-vendor order: clerk-client first (tests only, no release), then
navigation-service, auth-service and st-gateway, in any order. agent-service,
fleet-service and automation-service vendor no copy; they take the fixture
through clerk-client's suite. ai-service is parked and not re-vendored.

Version 6
(2026-10-03, owner's decision, found while porting agent-service to TS under
[meta#103](https://github.com/V-M-Pioneer-Trading/meta/issues/103)) adds ten
calling-service cases and one gateway case and changes none. It pins two rules
every client must apply identically.

- **Scopes are separated by space, tab, CR and LF, and by nothing else.**
  `scope` is split on runs of those four characters; leading, trailing and
  repeated separators yield no empty scope. Every other character — VT, FF,
  U+0085, a no-break space, U+2000–U+200A, an em space, U+2028, U+3000, a BOM,
  any Unicode space — is *part of* the scope token, so `fleet:control` +
  U+00A0 + `agent:reset` is one scope that is not `fleet:control`, and the
  route answers `403`. This is what the Go and Java clients already did.
  clerk-client split on `/\s+/`, which matches nearly all of those characters
  (not U+0085), and proceeded; auth-service's own operator routes used
  `strings.Fields`, which matches nearly all of them too (not U+FEFF). New
  cases: `active-with-only-spaces-in-scope`,
  `scope-joined-by-several-spaces`, `scope-joined-by-tab` (split),
  `scope-joined-by-no-break-space`, `scope-joined-by-em-space`,
  `scope-joined-by-vertical-tab`, `scope-joined-by-form-feed` (not split) and
  `active-with-non-separators-in-scope`, which asserts the opaque token
  through the identity.
- **Top-level keys are compared ignoring case.** Two keys equal ignoring case
  are a duplicate — a malformed answer exactly like version 5's exact repeat —
  and so is a contract key (`active`, `sub`, `scope`, `exp`, `kind`) spelled
  any way but its own, even once: `503` from a calling service, `background`
  from the gateway, one call to the center. A reader comparing keys exactly
  and one binding them case-insensitively, as Go's `encoding/json` does, would
  read such a body differently. The Go and Java clients already refused both
  forms (they lower every top-level key); clerk-client compared keys exactly
  and proceeded on `{"active":true,…,"Active":false}`. The cases pin **ASCII**
  case variants only: each client lowers keys with its language's Unicode
  lowering, and those agree on every ASCII letter but not on every non-ASCII
  one (Go lowers U+0130 to one character, Java and JavaScript to two). No
  client folds U+017F (long s) or any other character onto a contract key
  that its lowering does not. Below the top level version 5's rule stands: an
  exact repeat within one object is malformed, a case variant is not. New
  cases: `center-returns-case-variant-duplicate-key`,
  `center-returns-contract-key-in-another-case` and
  `gateway-center-returns-case-variant-duplicate-key`.

Re-vendor order: clerk-client (2.0.1) first, then agent-service,
navigation-service and auth-service, whose operator routes take the same
scope split and whose center test accounts for the new key-spelling bodies as
unproducible (the center marshals a struct). st-gateway, fleet-service and
automation-service take the rules by bumping to clerk-client 2.0.1; st-gateway
re-vendors the fixture in the same change, since its new gateway case fails on
2.0.0.

Version 5
(2026-09-30, [ts-introspection-client#6](https://github.com/V-M-Pioneer-Trading/ts-introspection-client/issues/6))
adds one calling-service case and one gateway case in which the center's
answer is JSON that names the **same top-level key twice** — `sub` twice, with
two different users — and changes none. That is a malformed answer, like an
unparseable body: a calling service answers `503 the authentication service
could not process this request`, the gateway lanes `background`, and the
center is called once. Go and Java already refuse such a body (a duplicate
check over `json.Decoder` in agent-service, Jackson
`STRICT_DUPLICATE_DETECTION` in navigation-service); the TS client read it
with `JSON.parse`, where the last value wins, and proceeded as the second
`sub`. It is not a bypass, since the center is trusted and local; it is a
divergence between clients, and three implementations must agree on what
malformed means. The center marshals a struct and never produces a duplicated
key, so these bodies are a client's obligation only. Re-vendor order:
ts-introspection-client first, then agent-service, navigation-service and
auth-service. auth-service's center test cannot produce a duplicate key by
construction, so it accounts for the case as unproducible rather than
running it.

Version 4
(2026-09-26) adds three calling-service cases and one gateway case in which
the request carries **two `Authorization` lines** — two bearer credentials,
or a bearer credential and an empty line — and changes none. To express them,
`request.authorization` may now be an array of two or more strings, one per
header line in order, `""` being an empty line; a single string is still one
line and `null` still none. Two lines are no credential: a guarded route
answers `401 a bearer token is required`, a public `GET` proceeds as a
visitor, the gateway lanes `background`, and the center is never called (see
[What is a bearer token](#what-is-a-bearer-token-and-what-is-not)). Every
client re-vendors version 4: ts-introspection-client next, agent-service and
navigation-service at step 11 of
[meta#80](https://github.com/V-M-Pioneer-Trading/meta/issues/80).

Version 3
(2026-09-25, [meta#87](https://github.com/V-M-Pioneer-Trading/meta/issues/87))
adds two calling-service cases and one gateway case in which the center's
active answer has **no `scope` key at all**. RFC 7662 makes the key optional,
and until [auth-service#4](https://github.com/V-M-Pioneer-Trading/auth-service/pull/4)
the center left it out for a token carrying no scopes; ts-introspection-client
1.0.0–1.1.0 read that as a malformed answer and served `503` to every
scopeless session in production. A client reads an absent `scope` exactly as
`"scope":""`: a session route proceeds with an empty scope list, a scoped
route answers `403`, and st-gateway lanes by `kind`. A `scope` that is
present but not a string is still a malformed answer. The center now always
sends the key, so these bodies are a client's obligation only.

Version 2 (owner's delegate, 2026-09-21) adds eleven calling-service cases
and one gateway case that pin the safe-method rule in both directions, exact
scope matching, what is and is not a bearer token, and which comparisons are
case-insensitive; it
changes no existing case and removes none. auth-service's own
vendored copy pins **version 1**, at meta commit `358231f`, and is re-vendored
at **step 11** of [meta#80](https://github.com/V-M-Pioneer-Trading/meta/issues/80);
it stays valid in the meantime because versions 2, 3, 4 and 5 only add cases a
*client* answers, and auth-service is the center. Version 3's and version 5's bodies are not
producible by the center at all, so its fixture test must classify them as
client-only when it re-vendors. A copy is allowed to lag the original;
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

*Dated 2026-09-29 — which suite drives which group.* The fixture's
`$gatewayCasesComment` says st-gateway consumes both groups through the shared
TS client, "so both groups must be driven by its suite". In practice the split
is by repository: ts-introspection-client's own suite drives the forty
calling-service cases, and
[st-gateway#11](https://github.com/V-M-Pioneer-Trading/st-gateway/pull/11)
drives only the twelve gateway cases, through its app. Every case is still
driven against the code that answers it, which is what the sentence was for;
this is the reading to take. The fixture's wording — and its `$comment`'s
"DECIDED 2026-09-20, NOT SHIPPED" — are left alone, because every client pins
the file's sha256, and a corrected sentence would cost a re-vendor in every
repository to say nothing new.

*Dated 2026-09-29 — an open divergence the fixture does not pin.* When the
center's answer repeats a JSON key, the TS client takes the last value, as
`JSON.parse` does, where the Go and Java clients refuse the body as malformed
and answer `503`. It is not a bypass: only the center writes that body, over
loopback or `authnet`, and it never repeats a key, so reaching the difference
takes a center that is already lying. It is still two answers where the
contract promises one. Tracked, open, as
[ts-introspection-client#6](https://github.com/V-M-Pioneer-Trading/ts-introspection-client/issues/6).

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
- **The session tier is a tier.** Four cases cover a route that requires a
  verified session and no particular scope: no header, an inactive token, and
  an active token carrying **no scopes at all** — once with `"scope":""` and,
  since version 3, once with the key absent — which must be allowed. A
  client that folds this tier into "public" passes the first two only by
  accident; one that folds it into "any scope" fails the last two.
- **`scope` is split on runs of space, tab, CR and LF, and nothing else**
  (version 6). Cases carry leading, repeated and trailing separators, which
  yield no empty scope; a client keeping the empties fails its identity
  assertion, and one splitting on a single space literal cannot find the
  required scope. Others join two scopes by VT, FF, a no-break space or an em
  space, which do **not** separate them: the pieces are one opaque scope, and a
  client that splits on `/\s+/` or `strings.Fields` finds a scope the token
  does not carry.
- **`scope` is always present on an active answer** (dated 2026-09-23). The
  center sends `"scope":""` when the token carries no scopes (no claim, an empty
  string or an empty array) and never leaves the key out. RFC 7662 would allow
  leaving it out, and until
  [auth-service#4](https://github.com/V-M-Pioneer-Trading/auth-service/pull/4)
  the center did: ts-introspection-client v1.1.0 read the missing key as a
  malformed answer and returned `503` on every session route for a signed-in
  user holding no scopes. Clients must still tolerate its absence and read it as
  `""`; fixture version 3 (meta#87) has cases whose stub omits the key. The
  contract is the center's to keep, but a client that fails closed on an
  RFC-legal shape turns a center regression into an outage.

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

## Minting a machine token

*Status: **decided 2026-09-30, not shipped.** Nothing in this section is
current behaviour: today automation-service mints its own token with a Clerk
Machine Secret Key it holds itself, and ai-service sends no credential. The
decision is
[auth-design.md decision 22](auth-design.md#22-auth-service-mints-every-machine-token);
the rollout is [meta#59](https://github.com/V-M-Pioneer-Trading/meta/issues/59).
This section is outside the normative scope above: it is not pinned by
`fixtures/introspection.json`, and it binds only auth-service and the two
callers of its client.*

*Dated 2026-10-01: shipped as written. Read the section as a description.*

Decision 22 makes auth-service the only holder of a Clerk Machine Secret
Key. A headless service that needs a bearer token of its own asks the center
for one. The caller side is thirty lines in
`@v-m-pioneer-trading/clerk-client` (`createCentralM2MTokenSource`), named
`@v-m-pioneer-trading/introspection-client` until 2.0.0.

**Request.** `POST /auth/v1/m2m-token`, empty body, header
`X-M2M-Caller-Secret: <the caller's own secret>`. The secret is the caller's
identity: auth-service maps it to a caller name and to that caller's fixed
scopes, comparing in constant time. There is no field in which a caller names
itself or asks for a scope. The route is bare, on the same listener as
`/auth/v1/introspect`, never behind Caddy at any method (decision 9's rule
for `/auth/v1/token` extends to it), reached at `localhost:3005` from
host-network services.

**Answers.**

| Situation | Status | Body |
|---|---|---|
| Known secret, token minted or served from cache | **200** | `{"token": "<jwt>", "expires_at": <unix seconds>}` |
| Missing, empty or unknown secret; caller disabled | **401** | `{"error": "unknown caller"}` |
| Mint failed and no cached token is still unexpired | **503** | `{"error": "the token could not be minted"}` |
| `OPTIONS` | **204** | — (the service's CORS preflight catch-all) |
| Any other method | **405** | — |

The token is a Clerk M2M JWT (locally, one signed with the dev key) whose
`sub` is the caller's Machine (`mch_…`, or `mch_local_<caller>` in dev) and
whose flat `scope` claim holds the caller's scopes. It lives 24 hours. The
**refresh point** is `iat + (exp - iat) / 2`, read from the token, on both
sides. The center serves the same token until then and mints on the next
request after it; a mint is detached from the request and single-flight, with
its own 10 s timeout and at least 10 s between failed attempts per caller. A
`401` names no caller and no secret, and the error bodies are deliberately
flat: no calling service relays them.

**What a caller does.** Fetch the token **at startup**: a `401` is a
configuration error, not a transient one, so exit loudly; on a `503`, a
timeout or a refused connection, log, start anyway and fetch lazily on first
use. Cache it,
refresh at the shared point, and if the refresh fails keep using the cached
token until it actually expires, then fail. Use a 1 s timeout and retry once,
immediately, after a timeout, because the first mint after an
auth-service restart is the one slow answer and the retry joins it; never
retry a `503` (the center's 10 s spacing makes it another `503`) or a `401`.
Never persist the token, never log it or the secret. Present it
as `Authorization: Bearer <token>` on every outbound call; the receiving
service sends it to `/auth/v1/introspect` like any other bearer token and sees
`kind: "machine"`.
