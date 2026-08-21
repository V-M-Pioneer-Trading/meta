# Authentication — Design Decisions

*Outcome of a design interview, 2026-08-19. Status: increment 1 shipped 2026-08-21
(see [Increment 1 — shipped](#increment-1--shipped) below); increments 2–4 pending.*

This document covers **two independent applications** that adopt the same vendor
for different reasons: this project (`spacetraders`) and `mradomsky/stagehopper`.
They share no code, no user pool and no session. They are recorded together
because several decisions only make sense as a contrast — the same policy is
enforced in different places, for reasons worth stating.

It supersedes [autopilot-design.md](autopilot-design.md) decision 4, *"Token:
paste-to-arm now, auth-service later"*, which named this work as a future step.

## Vision

Two things that are currently conflated get separated:

- **Who is operating the system** — a human identity, owned by Clerk.
- **Which credential talks to SpaceTraders** — a game token, owned by a new
  `auth-service`.

Today neither exists. The operator pastes a SpaceTraders token into the UI, it is
forwarded upstream on every hop, and automation-service's admin API has no
authentication at all. Afterwards the dashboard is publicly readable, every
mutating route requires a verified Clerk scope, and the
game token never enters the browser.

```
   public visitor            operator (Clerk session)
        │                             │
        │  GET only                   │  Authorization: Bearer <clerk jwt>
        ▼                             ▼
┌──────────────────────────────────────────────────┐
│ CloudFront  →  Caddy (TLS, X-Origin-Verify)      │
└───────┬──────────────────────────────┬───────────┘
        │                              │ /api/auth/v1/{status,agent-token,register}
        ▼                              ▼
┌───────────────────────────┐   ┌──────────────────────────┐
│ navigation / agent /      │   │ auth-service (Go+SQLite) │
│ fleet / automation        │   │  account + agent token   │
│  verify the Clerk JWT     │   │  wipe poll, re-register  │
│  locally (CLERK_JWT_KEY)  │   └────────────┬─────────────┘
└───────────┬───────────────┘                │ agent token
            │ no Authorization header        │ (authnet only)
            ▼                                ▼
        ┌──────────────────────────────────────────┐
        │ st-gateway — injects the agent token,    │
        │ owns the rate budget and all retries     │
        └────────────────────┬─────────────────────┘
                             ▼
                     SpaceTraders API
```

## Current state being replaced

- **spacetraders** — no identity of any kind. A SpaceTraders bearer token is
  pasted into the UI, kept in `sessionStorage`, and forwarded through
  agent/navigation/fleet-service to st-gateway. automation-service's entire admin
  API (`/autopilot/arm|pause|abort`, `PUT /planner/knobs/:name`,
  `POST /planner/replan`) is unauthenticated **and publicly routed by
  CloudFront**. This was verified live: `GET /api/automation/v1/planner/knobs`
  returns the full knob set with no credential. Closing it is the only urgent
  item in this document.
- **stagehopper** — Google Identity Services One Tap, ID token verified
  server-side in the Lambda with `google-auth-library`, admin gated on an
  `ADMIN_EMAILS` allowlist plus `email_verified === true`. It works and has no
  known gap. Its migration is a simplification, not a fix.

## Increment 1 — shipped

Closed the live hole (build order step 1): automation-service's mutating
routes verify a Clerk session and require `fleet:control` or `agent:reset`
([automation-service#10](https://github.com/V-M-Pioneer-Trading/automation-service/pull/10)),
command-interface has a real headless Google sign-in
([command-interface#17](https://github.com/V-M-Pioneer-Trading/command-interface/pull/17)),
and the spacetraders Clerk instance is live: Google-only, `restricted`
sign-up, one operator.

**Not done, and load-bearing for increment 2**: decision 13's shell inversion.
`App.jsx` still gates the entire dashboard on the pasted SpaceTraders token —
`token ? <Dashboard /> : <LoginScreen />` — so an anonymous visitor never
reaches the dashboard at all. Decision 2's "every `GET` is public" is
therefore not actually true yet; there is no public visitor to serve it to.
Gating nav/agent/fleet-service on Clerk (build order step 2) does not by
itself deliver decision 2's goal while this gate stands in front of it —
finishing the inversion is part of what "increment 2" has to mean, not a
separate, later task.

**New artifact this design doc predates**: [`mradomsky/clerk-config`](https://github.com/mradomsky/clerk-config),
configuration-as-code for both Clerk tenants — instance settings and JWT
templates applied from a workstation, never CI, for the same reason
`infrastructure`'s `bootstrap/` isn't automated either (see its
`docs/security-model.md`). Decisions 1, 10 and 12 describe *what* the
spacetraders tenant looks like; `clerk-config`'s `apps/spacetraders/dev.json`
is now the authoritative, reviewable record of that configuration, not this
document.

**Two implementation lessons worth recording, both from bootstrapping the
first real operator account**:

- **The allowlist does not admit anyone under `restricted` mode — only
  `public`.** Per Clerk's own docs, allowlist membership is irrelevant once
  sign-up is restricted; only an existing user or an invitation gets in. A
  first version of `clerk-config`'s apply-safety guard treated allowlist
  membership as sufficient, which nearly locked the operator out of a
  zero-user instance — the guard passed, the apply "succeeded", and Clerk
  silently declined to turn `allowlist_enabled` on in the same call. Full
  writeup: [clerk-config#3](https://github.com/mradomsky/clerk-config/issues/3).
  Bootstrapping a restricted, OAuth-only, zero-user instance requires a
  temporary `public` → real sign-in → `restricted` sequence; there is no way
  to admin-create the first user directly when the instance has no
  identifier (e.g. email) enabled other than OAuth.
- **A headless `authenticateWithRedirect` sign-in does not create an account
  for a brand-new OAuth identity.** `useSignIn()` alone can only find an
  *existing* user; for a new one, Clerk marks the attempt `transferable`
  rather than erroring, and the app must explicitly call
  `signUp.create({ transfer: true })` to complete it. Decision 12's "headless"
  choice didn't originally account for this — the first version of
  `OperatorBadge` only ever called sign-in, so a first-time sign-in silently
  bounced back to the login screen with no session and no error. Fixed in
  [command-interface#20](https://github.com/V-M-Pioneer-Trading/command-interface/pull/20).

## Decisions

### 1. Two Clerk applications, not one, and not three

Separate Clerk applications with fully isolated user pools. No cross-app SSO, no
shared session, no account linking; a person signing into both is two unrelated
users. Clerk's Hobby plan includes unlimited applications, so the isolation is
free.

The third candidate, `radomskyi-com`, gets **no tenant**. It is S3 + CloudFront +
an origin access control with no Lambda, no API and no datastore — a tenant there
would authenticate access to nothing.

Rejected: one application with Clerk *organizations*. Organizations model B2B
tenancy, which does not exist here, and choosing them would be irreversible
without a user migration.

### 2. spacetraders is publicly readable and privately writable

**Every `GET` is public; every mutating route requires a verified Clerk scope.**
Anonymous visitors get the observability surface — event log, planner decisions
with their scoring inputs, metrics, knob values, autopilot status, per-ship task
state — *and* the live reads: agent profile, ships, contracts, market and
shipyard data. There is exactly one operator.

The event log is deliberately included despite carrying credit balances and
contract terms. It is the most interesting artifact the system produces, and a
reviewer should be able to watch the fleet without asking for credentials.

Anonymous live reads spend the shared ~2 req/s SpaceTraders budget, and that is
accepted. Two things keep it from being a liability.

**Priority is derived from the verified identity, not from a header.** st-gateway
today takes its priority class from a client-supplied `X-Priority` header — its
own comment reads *"Callers declare their priority class."* That is safe only
while a token is required. Once reads are public, a crawler sending
`X-Priority: interactive` (which the frontend sends on every call) would outrank
the fleet's own mining actions. So: **anonymous resolves to `background`, an
an operator session to `interactive`**, decided from the token rather than
asserted by the caller. Public traffic then queues *behind* the autopilot by
construction. The worst a bot can do is consume slack, which turns "we can deal
with bots later" from a hope into a property. Paired with a short CloudFront TTL
on the public GETs, the exposure is bounded rather than merely monitored.

**Two scopes, split on reversibility.**

| Scope | Covers | Blast radius |
|---|---|---|
| `fleet:control` | arm, pause, abort, replan, knob writes | reversible |
| `agent:reset` | `POST /register` (Reset Agent), `POST /agent-token` (Restore Token) | **irreversible / credential-bearing** |

`agent:reset` is fenced separately because it is the only operation that can
destroy a fleet — the same instinct that already fences `alert` knobs off from
the AI supervisor. With one human holding both it is documentation rather than
access control today; it costs one line in a JWT template, and it is the natural
seam for a guest operator who may watch and tune but not re-register the agent.

Rejected: **a `dashboard:view` scope.** Anonymous visitors carry no token at all,
so it could never be evaluated. A scope that is never enforced is worse than no
scope, because it reads as a control in the JWT template while doing nothing.

**Admin actions record their actor.** With a real identity available,
automation-service writes `detail.actor` — the Clerk user id — on every event
originating from a mutating route. The id only, never the token: `eventLog.ts`
already forbids anything token-shaped in `detail`, and that rule stands.

Rejected: **login-walling the whole dashboard**, which hides the work this
project exists to show; and **multi-tenant sign-up where each user brings their
own agent**, which sounds more impressive and would multiply every piece of
automation-service state by N while dispatch is still keyed to one configured
mining ship.

### 3. Live anonymous reads are allowed where a visitor cannot expand them

Decision 5 puts the agent token in st-gateway, so nav/agent/fleet *can* serve
anonymous callers — the question is which of them should. The line is not
"live versus cached" but **bounded versus unbounded**: whether one visitor can
turn a page load into arbitrarily many upstream calls.

| Surface | Anonymous | Why |
|---|---|---|
| automation-service reads | live | Postgres-backed; no upstream call at all |
| agent-service reads (agent, ships, contracts) | live | **bounded** — a fixed set of endpoints over one small fleet; nothing a visitor supplies enlarges it |
| navigation-service (waypoints, market, shipyard) | **cache-only**, 401 on miss | **unbounded** — every route is parameterised by system and waypoint, so a visitor panning the map could enumerate thousands |

So navigation-service's controllers become `required = false` on `Authorization`
and serve from SQLite when the caller is anonymous. Waypoint positions are
immutable, so this is free rather than merely cheap; market data has a short TTL,
which means an anonymous viewer sees slightly stale prices — an acceptable trade
for a read surface a stranger controls the cardinality of.

The visible consequence — **the public map fills in as the fleet explores** — is
intentional, and now has a second reason beyond the aesthetic one: this is the
only read surface where a single visitor could otherwise generate unbounded
upstream traffic.

Rejected: **making live reads admin-only**, which would hide the fleet from
exactly the visitors decision 2 exists to serve. Also rejected: **falling through
to a live fetch on a navigation cache miss**, which is the same unbounded
enumeration wearing a politer name. If the public map should show live ship
positions later, the right answer is automation-service persisting a fleet
snapshot each tick, so the read stays a Postgres read.

### 4. auth-service owns game credentials only; authorization is a library

The new service holds SpaceTraders credentials, detects universe resets and
re-registers. It does **not** answer "may this user do this."

Clerk authorization is verification code inside each service, not a network call.
Making it a hop would put a synchronous dependency on the hot path of every
request, create a single point of failure where auth-service down means the whole
system returns 403, and discard the property that makes asymmetric JWTs worth
adopting: a signed token is verifiable offline. Permissions travel in the token's
**`scope`** claim (free on Hobby); Clerk session tokens are short-lived and
SDK-refreshed, so revocation is near-immediate anyway.

`scope` rather than `role` in both applications, deliberately: API Gateway's
`authorization_scopes` (decision 14) matches that claim specifically, so choosing
anything else would force stagehopper and spacetraders to disagree about where a
permission lives for no gain.

**Delivered by session-token customisation here, a JWT template in stagehopper.**
Clerk offers both. Customising the *default* session token adds the claim to
what `getToken()` already returns, with no template name at the call site;
a JWT template mints a separate token that must be requested by name but can
carry an explicit `aud`. spacetraders verifies with the PEM key itself and needs
no particular audience, so it takes the simpler route. stagehopper cannot — an
API Gateway authorizer demands an `aud` — which is the second time the two apps
diverge for a reason rather than a preference.

**The claim must map from `public_metadata`, never `unsafe_metadata`.** Both are
available as shortcodes and only one is safe: `unsafe_metadata` is writable by
the signed-in user from the browser, so sourcing a permission from it would let
any account grant itself `fleet:control` and then present a perfectly valid,
correctly-signed token carrying it.

Rejected: **a central authorization service**, for the reasons above.

### 5. st-gateway injects the agent token; nothing else holds it

Callers stop sending an `Authorization` header for game calls. st-gateway asks
auth-service for the agent token, caches it in memory, and injects it on every
upstream call. It is already documented as *"the only door to SpaceTraders"*;
this makes that true of credentials and not only of the rate budget. Its token
handling today is one line — copying the caller's header — and becomes one line
injecting its own.

st-gateway already owns retry and backoff, so `401 from SpaceTraders → refetch
from auth-service → retry` lives in the one component that already has that
machinery. The `authHeader` parameter threaded through every controller, service
and client in four languages is deleted.

**Two behaviours to specify while implementing this.** `GET /` is the only
SpaceTraders endpoint that needs no credential (`security: [{}, {AgentToken}]`),
so **st-gateway does not inject on it**. That is not a special case for
convenience — it is what lets auth-service poll for wipes *through* st-gateway
like every other caller, instead of needing a documented bypass. Without it,
auth-service asking st-gateway to poll would have st-gateway asking auth-service
for a token to make the call, which is a cycle for no reason. And when
auth-service has no token to give (`UNCONFIGURED`), st-gateway returns **503 on
game calls and passes `GET /` through** — the one path that still works is the
one that can tell you why nothing else does.

`POST /autopilot/arm` consequently loses its `token` field and becomes
`{ mode }`. `AutopilotState.token`, the arm-token field in the Autopilot panel,
and the READMEs describing both are deleted with it.

Rejected: **each service pulling and caching its own copy**, which puts four
caches, four refresh implementations and four copies of the credential where one
suffices.

### 6. The account token is persisted, and the fleet recovers unattended

This reverses an earlier position in the same interview, and the reasoning is
recorded because the reversal is the interesting part.

The first decision was that the account token — the only credential that can mint
agents — should never be at rest: the operator would paste it into a "Reset
Agent" dialog, auth-service would hold it in memory for one `POST /register` and
discard it. That is strictly safer, and it was rejected because it cannot deliver
the project's stated end state: *"flip it, walk away, and the fleet keeps earning
on its own."* A system that stops dead every fortnight until a human pastes a
string does not meet its own goal.

The asset is a **free game credential**. Worst-case compromise is a stranger
registering spam agents or burning a call sign — no money, no personal data, no
lateral movement. Storing it is a judgment about asset value, not a security
concession.

It lives in **auth-service's SQLite file on the isolated `authnet` bridge** —
never in SSM, never in an environment variable, never in Terraform state. SSM was
rejected specifically: parameters on that host are read through the *shared EC2
instance profile*, and every container reaches IMDS, so an SSM parameter is
readable by anything running on the box. A SQLite file behind a private bridge is
not. `SecureString` is the right home for the `X-Origin-Verify` secret and the
GHCR pull token; it is the wrong home for this.

The narrower claim survives and should replace the blanket one in
[architecture.md](../architecture.md): **no service persists a token it does not
own.** Exactly one service owns these, and it is the only one that stores them.

### 7. Re-registration triggers on an observed reset, never on a forecast

`GET /` on the SpaceTraders API is **unauthenticated** and returns `resetDate`
(when the server last reset), `serverResets.next` and `serverResets.frequency`.
auth-service stores `resetDate` alongside the agent token and polls that endpoint
**through st-gateway at `background` priority**, like every other caller — see
decision 5 for why no bypass is needed.

- **A change in `resetDate` is a fact.** It confirms a wipe has already happened,
  the previous fleet is already destroyed, and re-registering costs nothing. This
  is the only trigger that registers.
- **`serverResets.next` is a prediction**, used to decide how often to poll:
  **once a day** normally, **hourly** within **24 hours** of the predicted reset.
  That 24-hour boundary is also what raises `WIPE_IMMINENT`.
- **Entering the window is a local clock comparison, not a poll result.**
  auth-service stores `serverResets.next` from the last poll and flips to
  `WIPE_IMMINENT` on its own timer at `next - 24h`. This is not optional: with a
  daily poll and a 24-hour window, waiting to *observe* the window on a poll
  could land at `next - 1h` and reduce a day of warning to an hour. The schedule
  governs how often the prediction is refreshed, never when the state changes.
- **A 401 forces an immediate, out-of-cycle poll.** The schedule is a backstop,
  not the detection path. Without this the daily cadence would leave the fleet
  halted for up to 24 hours after a wipe, waiting to confirm something the 401
  already implied.
- **A 401 with no `resetDate` change is not a wipe.** It means the token was
  revoked or corrupted. auth-service halts into `APP_TOKEN_EXPIRED`, automation
  auto-disarms, and a human decides.

Firing on the forecast is the one catastrophic path in this design. If `next`
elapses but the server has not actually reset, registration runs against a live
universe: the same call sign returns 409 and the system is stuck, a different
symbol abandons a working fleet and restarts at 175,000 credits.

`POST /register` accepts an `email`, used when a call sign is reserved between
resets. **Reserve the call sign and pass it.** Without it every automatic
re-registration produces a new agent symbol, and the event log, metrics rollups
and per-field revenue calibration silently stop correlating across resets — the
fleet survives the wipe and its measured model does not.

Rejected: **auto-registering on any dead token**, and **requiring a human for
every reset**. A manual "Reset Agent" control is retained as an override and as
the recovery path for the 401 case.

### 8. auto-disarm is not auto-register

When a wipe is detected, automation-service disarms into a distinct
`APP_TOKEN_EXPIRED` state: ticking stops, anomaly checks suspend, and one wipe event
is logged instead of thousands of 401s. It learns this by reading
`GET /auth/v1/status` on the scheduler tick it already runs, rather than
auth-service pushing to a subscriber list it would have to maintain and retry.

The rule is not "never act automatically" but **"never act irreversibly without a
human."** Disarming is protective and reverses freely; registering was gated on a
confirmed wipe precisely because it does not.

Leaving the autopilot running through a wipe was rejected: it burns the rate
budget, floods the audit trail, and triggers the anomaly detector into webhooking
ai-service, which would then tune knobs in response to a problem no knob can fix.

**What the dashboard renders.** Two states, two banners, both a full-width
scrolling marquee across the top of the screen — the one piece of chrome that
survives on every panel, because this is the only condition where what the
operator is currently looking at has stopped meaning anything.

| State | Trigger | Banner |
|---|---|---|
| `WIPE_IMMINENT` | local clock passes `serverResets.next - 24h`; polling goes hourly | *"Genesis Device detonation is imminent. Prepare for total sector reformation."* |
| `APP_TOKEN_EXPIRED` | 401 with no `resetDate` change — token revoked or corrupted | *"Genesis Device detonation unconfirmed. Sector integrity cannot be verified. Awaiting command authorization."* |

`WIPE_IMMINENT` is advisory: the fleet keeps working right up to the wipe, and
recovery afterwards is automatic, so the banner informs rather than asks. It is
also the state that pays for the `serverResets.next` poll — without a visible
countdown the prediction is only ever read by a scheduler.

`APP_TOKEN_EXPIRED` is the one that needs a human, and its copy says so: an
unconfirmed detonation is precisely the case where the token died but no reset
was observed.

**The action in that banner is Restore Token, not Reset Agent.** The distinction
is the entire safety property of the state. `APP_TOKEN_EXPIRED` means
`resetDate` did *not* change — the universe is live and the fleet still exists —
so Reset Agent (`POST /register`) would either 409 against the operator's own
living call sign or spawn a second agent and abandon a working fleet. The
recovery is to regenerate an agent token for the *existing* agent on
`my.spacetraders.io` and hand it to auth-service.

Reset Agent stays reachable from this banner but demoted and
confirmation-gated. After a confirmed wipe it is free, because the fleet is
already gone; here it is destructive, and the UI must not present the two as the
same button.

There is deliberately **no banner for a confirmed wipe**. `resetDate` changing
triggers re-registration within seconds of the forcing 401, so the state exists
for less time than it takes to read a marquee. It goes to the event log, not the
screen.

**How this reaches the UI — and no, it is not a new concept.** The dashboard
already polls a service for its own domain state machine: `GET /autopilot/status`
returns `{status, mode}` over `disarmed | armed | paused | aborted`, and
`SystemStatus` separately polls `/api/<service>/health` once per monitored
service. auth-service's `GET /auth/v1/status` is the *second* instance of an
established pattern, not a new one, and the frontend gains one more poll rather
than a new abstraction.

What is genuinely new is that there are now **two state machines on different
axes**:

| | Owner | Question it answers |
|---|---|---|
| `disarmed`/`armed`/`paused`/`aborted` | automation-service | is the autopilot running |
| `HEALTHY`/`WIPE_IMMINENT`/`APP_TOKEN_EXPIRED`/`UNCONFIGURED` | auth-service | can we talk to the game at all |

They are **not composed in the frontend, and there is no precedence rule** —
which is the point of decision 8's auto-disarm. automation-service reads auth
state on the scheduler tick it already runs and disarms itself, so the two can
never disagree in a way the UI would have to arbitrate. The banner is driven by
auth state alone; the panels by autopilot status alone. An `armed` autopilot
sitting behind a dead token is a combination the system cannot report, because it
is a combination the system does not enter.

A rejected alternative: **automation-service merging credential state into
`GET /autopilot/status`** so the UI makes one call instead of two. It saves a
poll and costs a service reporting state it does not own — and the frontend
already polls several services independently, so the saving is not real.

`GET /auth/v1/status` is public, so anonymous visitors see the banners too. That
is intentional: a system that narrates its own lifecycle — including the two
weeks it spends waiting to be destroyed — is showing more than one that hides it.
The **Restore Token** and **Reset Agent** controls inside the banner render only
for the `agent:reset` scope, on the same disabled-and-visible rule as every other
gated control.

### 9. auth-service is isolated by network, secret and firewall — not by one of them

The production host runs every container with `--network host`, one shared
namespace, so "only st-gateway can reach auth-service" is otherwise
unenforceable.

- **`authnet`**, a private Docker bridge holding auth-service, st-gateway and
  Caddy. auth-service publishes **no host port**. st-gateway additionally
  publishes `-p 127.0.0.1:3002:3002` so the four host-network services keep
  reaching it unchanged.
- **Caddy is on `authnet` deliberately.** The Reset Agent flow carries the
  account token from the browser, and routing it through any host-network service
  would expose that credential to a service that has no business seeing it.
  Caddy routes only `/api/auth/v1/{status,agent-token,register}`;
  `/auth/v1/token` has **no Caddy route at any method**.
- **A shared secret** on auth-service, same pattern and same storage as
  `X-Origin-Verify`. The bridge is a boundary, not an authenticator.
- **A `DOCKER-USER` iptables rule** blocking host-namespace routing to the
  `authnet` subnet. A bridge alone does not isolate from `--network host`
  containers, which can still reach the subnet by IP.

Relying on the bridge alone was rejected for that last reason; relying on the
shared secret alone was rejected because a secret in an environment variable of a
container sharing the namespace raises the bar without setting a boundary. Moving
the entire host onto user-defined bridges is the structural fix and is tracked in
[meta#58](https://github.com/V-M-Pioneer-Trading/meta/issues/58).

### 10. Verification is networkless, and local development uses its own keypair

Every service verifies with Clerk's **PEM public key** (`CLERK_JWT_KEY`) rather
than fetching JWKS. That removes a network dependency from the hot path and any
cache-staleness logic in three languages, and because a public key is not a
secret it is a plain environment variable.

It also solves testing and local development without a bypass. The verification
code path is byte-for-byte identical in local, CI and production; only the trust
anchor differs, which is what a trust anchor is for. `git clone && docker compose
up` still needs no vendor account.

- **Local development**: one fixed self-signed keypair lives in **`meta`**, next
  to the `docker-compose.yml` that distributes it. A small dev token minter signs
  an `admin`-scoped JWT with the private half; every service gets the public half
  as `CLERK_JWT_KEY`. A fixed pair is required here because the minter and the
  services must agree on one.
- **CI**: each repository **generates an ephemeral keypair per test run** and
  signs its own tokens. Nothing has to be shared across repositories, and no
  private key is committed anywhere but `meta`.

The dev key must be unmistakably a dev key in its key id. It signs nothing
production trusts.

Rejected outright: **an auth-optional local mode or a test bypass flag.** A code
path that disables authentication is a production vulnerability that passes CI,
and it eventually ships enabled.

Known gap: auth-service's reset-recovery path cannot be exercised locally,
because no account token exists there. Its tests stub `POST /register`, and the
real path first runs during an actual universe wipe. This is accepted knowingly.

### 11. ai-service authenticates with a shared secret, not a Clerk identity

`POST /api/automation/v1/events` is a mutating route called machine-to-machine by
the AI supervisor. It has no Clerk user and no browser, so it does not fit
"mutating means admin."

A shared secret is used, consistent with auth-service and `X-Origin-Verify`.
Clerk **M2M tokens** would be a better fit in principle — scoped, short-lived,
individually revocable — and are viable on Hobby (2,500 creations and 100,000
verifications free monthly, far above realistic volume). They are deferred
because the feature only gained JWT format in February 2026, and because routing
an internal hop through an external vendor contradicts the standing rule that the
deterministic core survives third-party outages. Tracked in
[meta#59](https://github.com/V-M-Pioneer-Trading/meta/issues/59).

### 12. spacetraders sign-in: restricted, Google-only, headless

Sign-up is set to **restricted** — there is one legitimate operator, so a public
sign-up form is a pointless surface. Google OAuth is the only enabled method.

Because the sign-in is one button and a redirect, the **headless** hook is used
behind the existing LCARS `PillButton`. No Clerk component renders, which means
no `appearance` API fight to make a hosted form look like LCARS, and no
*"Secured by Clerk"* badge — a paid feature that stops mattering when nothing of
Clerk's is on screen.

### 13. The app shell inverts: there is no login wall

*Status: **not yet done**. See [Increment 1 — shipped](#increment-1--shipped) —
`App.jsx` still gates the dashboard on the pasted SpaceTraders token. This is
now part of increment 2's scope, not a separate later task.*

`LoginScreen.jsx` is currently the front door — no token, no dashboard. It is
removed. The dashboard always renders, sign-in becomes a small operator
affordance in the chrome, and gated controls — arm, pause, abort, knob edits,
Reset Agent — render **disabled and visible** rather than hidden.

A visitor should be able to see that an arm/abort/knob surface exists and is
gated. Hiding it makes the system look less capable than it is; a disabled
control is self-documenting in a way an absent one is not.

This is a restructure of the shell rather than a component swap, and it is where
most of the frontend work sits.

### 14. stagehopper verifies at API Gateway, with scope-based admin routing

An `aws_apigatewayv2_authorizer` pointed at Clerk's issuer guards 14 of the 15
routes; unauthenticated requests never invoke the Lambda. The 9 admin routes
additionally carry `authorization_scopes = ["admin"]` against the `scope` claim
emitted by a Clerk JWT template, so **non-admins are rejected at the gateway**.

**One blunt `admin` scope here, deliberately unlike spacetraders' two.** This
app's middle tier is "any signed-in user," which the authorizer's mere presence
already proves, so a second scope would name a distinction the route table does
not make. spacetraders splits `fleet:control` from `agent:reset` because it has
an irreversible operation to fence; stagehopper has none.

**To verify before building — decision 14 rests on it.** An API Gateway JWT
authorizer requires both an `issuer` and an `audience`, and Clerk's default
session token may carry no `aud` claim. If so, a JWT template with an explicit
audience is mandatory rather than merely tidy. Confirm this first; everything
else here is downstream of the gateway accepting the token at all.

`resolveGoogleIdentity`, `isAdminIdentity`, `extractGoogleIdToken`, the
`ADMIN_EMAILS` variable and the `google-auth-library` dependency are all deleted.
The admin gate becomes declarative Terraform, reviewable in a plan diff. The
`email_verified === true` guard becomes unnecessary — its purpose was that an
unverified address is a string the user chose, and a signed role claim has no
such weakness. The handler reads
`event.requestContext.authorizer.jwt.claims.sub`, which API Gateway populates and
clients cannot forge. Lambda tests construct that claim directly, so the ~25 spec
files get simpler rather than harder. JWT authorizers are free.

This is deliberately the **opposite** of decision 4 for the same policy. There is
a platform gate available here and none in spacetraders; the split is per-route
here and per-method there; and navigation-service needs the caller's identity
even on public reads, which a binary gateway verdict cannot supply.

`GET /rooms/{roomId}/selections` stays fully public. Room IDs are capability
URLs, and that is now an explicit choice rather than an artifact.

### 15. stagehopper's token moves to the `Authorization` header

An authorizer cannot read a request body, so the token stops travelling in one.
`allow_headers` gains `Authorization`.

This looks like a loss and is the opposite. The body-transport choice deformed
the REST surface: `POST /users/me/rooms` and `POST /admin/me` are POSTs only
because a token could not ride a GET, and `GET /admin/festivals` does not exist
for the same reason — a compromise the code documents in place. All three become
the verbs they always were.

Clerk session tokens are short-lived, so the client calls `getToken()` per
request rather than caching an identity. That is not extra work: it deletes the
`inFlightRefresh` dedupe and the One Tap silent-refresh machinery in `auth.ts`,
and `google-identity.ts` entirely — roughly 200 lines of script loading, manual
JWT decoding and expiry arithmetic.

### 16. stagehopper cuts its keyspace over cleanly

The participant key changes from `google:${sub}` to `clerk:${userId}`. It is the
partition key of `users`, the sort key of the selections table, and the partition
key of `push_subscriptions`.

With **two real users**, the tables are dropped and recreated, exactly as the
last consolidation did. No backfill code is written.

Rejected, but recorded because it is the right answer at any real scale: a **lazy
per-user backfill**. Clerk exposes the linked Google account's original `sub` as
`external_accounts[].provider_user_id`, so on a user's first Clerk sign-in the
old `google:${sub}` rows can be rewritten to the new key and deleted — no
downtime, no migration window, no dual-key scheme living in the code forever.

### 17. stagehopper uses vanilla `clerk-js`, and keeps open sign-up

The app builds with `adapter-static` and prerenders at the root, so layout code
executes in Node at build time and `hooks.server.ts` never runs. The official
SvelteKit integration is therefore unusable. **`@clerk/clerk-js`, guarded by
`browser` from `$app/environment`** — unguarded initialisation breaks the build
rather than runtime, which is the better failure mode but a confusing one.

Sign-up stays **open**, the opposite of decision 12, because it is a room-sharing
app for friends and a closed instance breaks the product. The prebuilt `<SignIn/>`
component is used here — multiple methods, sign-up and password reset are flows
worth not hand-rolling — and the *"Secured by Clerk"* badge is accepted.

## New repository: `auth-service`

**Go, SQLite.** Go because this service's job is holding a credential, and a
static binary with a small dependency tree against an npm tree is the one place
in this system where dependency surface is a security argument rather than a
taste one; agent-service already sets the precedent. SQLite because the state is
a handful of rows plus a registration history, navigation-service already
establishes the pattern, and the alternative considered — SSM — is readable by
every container on the host.

| Route | Reachable from | Auth | Purpose |
|---|---|---|---|
| `GET /auth/v1/token` | `authnet` only, no Caddy route | shared secret | st-gateway fetches the agent token |
| `GET /auth/v1/status` | public | none | state machine; never returns a token |
| `POST /auth/v1/agent-token` | public | Clerk `agent:reset` scope | **Restore Token** — accept a regenerated agent token for the existing agent |
| `POST /auth/v1/register` | public | Clerk `agent:reset` scope | **Reset Agent** — mint a new agent with the account token |
| `GET /health` | public | none | liveness |

`status` returns the state (`HEALTHY`, `WIPE_IMMINENT`, `APP_TOKEN_EXPIRED`,
`UNCONFIGURED`), the agent symbol, the stored `resetDate` and the next predicted
reset. It never returns a token in any state.

**Restore Token and the internal fetch deliberately do not share a path.** The
obvious spelling would have been `GET` and `POST` on `/auth/v1/token`,
distinguished by method — but then a single mistake in Caddy's method matcher
publishes the route that hands out the agent token. Different paths make that
failure impossible rather than unlikely: `/auth/v1/token` has no Caddy route at
any method, and `/auth/v1/agent-token` is write-only.

`POST /auth/v1/agent-token` exists because SpaceTraders offers no way to renew an
agent token through the API — `POST /register` is the only `AccountToken`
operation, and it creates a *new* agent. When a token dies without a wipe, the
only non-destructive recovery is a human regenerating one on the account
dashboard. Without this route `APP_TOKEN_EXPIRED` would be a state with no exit
that does not cost the fleet.

## Build order

The ordering constraint is not cosmetic. navigation-service, agent-service and
fleet-service are currently protected *by accident*: they demand a game token,
and only the operator has one. Decision 5 removes that accidental gate. **If
injection ships before Clerk verification lands on those three, they are open to
the internet with a valid token behind them** — a worse hole than the one being
fixed.

1. **Close the live hole.** ✅ Shipped 2026-08-21 — Clerk tenant (sign-up
   **restricted**, Google-only, session token customised to emit `scope` from
   `public_metadata`), verification in automation-service, its mutating routes
   gated, and `VITE_CLERK_PUBLISHABLE_KEY` injected at build time in
   command-interface's workflow — a publishable key is public, so this is
   configuration rather than secret handling. See
   [Increment 1 — shipped](#increment-1--shipped) for what landed and what
   didn't: **the shell inversion did not ship with this step** and carries
   into step 2 below.
2. **Gate the other three, and open the map.** Verification in
   navigation-service, agent-service and fleet-service; navigation's cache-only
   anonymous waypoints; **and the shell inversion carried over from step 1** —
   `App.jsx` no longer gating the dashboard on the pasted token. All three
   matter together: gating the backend services on Clerk doesn't make the
   dashboard actually public while the frontend still walls it off first.
   Deliberately *before* injection, so these services are
   never ungated for a single deploy.
3. **auth-service and injection.** st-gateway injecting and skipping `GET /`,
   pass-through deleted from four services, **priority derived from the verified
   identity rather than `X-Priority`** (decision 2 — this is what makes public
   live reads safe, so it ships *with* injection, not after), and ai-service's
   shared secret.

   "The new service" is roughly ten discrete pieces, not one: GitHub repository,
   GHCR package, Terraform stack in `V-M-Pioneer-Trading/infrastructure`, CI
   workflow, SSM bootstrap document, **a persistent volume for the SQLite file**
   (navigation-service sets the pattern), Caddy route block, CloudFront behaviour
   for `/api/auth/v1/*` plus a short TTL on the public GETs, the `authnet`
   bridge, the `DOCKER-USER` rule, and the shared secret created out of band with
   `aws ssm put-parameter`.
4. **Documentation.** Split the *"No service stores a token"* claim in
   `architecture.md` per decision 6; correct
   [autopilot-spec.md](autopilot-spec.md)'s account/agent token confusion; add
   the Caddy topology missing from `operations.md`.

**stagehopper is an independent stream** — separate tenant, separate repository,
no shared code — and can land at any point.

## Deferred, and tracked

- [meta#58](https://github.com/V-M-Pioneer-Trading/meta/issues/58) — move the
  whole host off `--network host` onto user-defined bridges, converging
  production with `docker compose`, which already uses service-name DNS.
- [meta#59](https://github.com/V-M-Pioneer-Trading/meta/issues/59) — replace the
  ai-service shared secret with Clerk M2M tokens.
- **Per-container IAM.** Every container reads the shared EC2 instance profile
  through IMDS, so SSM parameters are effectively host-wide. Fixing this properly
  needs ECS task roles or EKS IRSA — a different hosting model, not a
  configuration change.
- **`spacetraders-mcp-server` is deliberately out of scope, and will break.**
  It calls `PUT /planner/knobs/:name` and `POST /planner/replan` with no
  authentication — its client comment names the unauthenticated posture
  explicitly — so it stops working the moment increment 1 lands. It also holds
  `SPACETRADERS_API_TOKEN` and calls `api.spacetraders.io` **directly**, making
  it a fourth holder of the game token that bypasses st-gateway entirely and
  whose credential goes silently stale at every automatic re-registration. It is
  unused and outdated, so this is accepted rather than solved. Reviving it means
  giving it the same shared secret ai-service uses, and pointing it at
  st-gateway.
- **`spacetraders-mcp-server`'s generated client is stale.** Separately from the
  above: it carries the pre-2.3 `register({faction, symbol, email})` signature
  with no account token and cannot register against the current API. auth-service
  is written against the live spec; the generated client wants regenerating.
- **Clerk production prerequisites have external lead time.** A production
  instance needs custom-domain CNAME records — propagation up to 48 hours — which
  belong in `mradomsky/infrastructure`'s Route53 config, and it cannot use
  Clerk's shared Google OAuth credentials, so each application needs its own
  Google Cloud OAuth client. stagehopper already has one (`GOOGLE_CLIENT_ID`) and
  should reuse it. Start both before the build order, not during it.
- **Rehearsing a wipe.** A `POST /auth/v1/simulate-wipe` was considered and
  declined; the reset path will first run for real during an actual reset.
