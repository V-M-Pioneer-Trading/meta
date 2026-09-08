# What a service answers when st-gateway doesn't

Normative for agent-service, fleet-service and navigation-service — the three
services that call SpaceTraders through st-gateway.

## The rule

**st-gateway already decided what went wrong. Relay its answer.** A client
service classifies exactly one condition — "the gateway did not answer me" —
and relays every other.

| Condition | Status | Message | Headers |
|---|---|---|---|
| The gateway answered non-2xx | **its status, unchanged** | its `error.message`, or the raw body truncated to 500 characters when there is no envelope to read | relay `Retry-After` and `X-RateLimit-*` when present |
| The gateway did not answer — connection refused, DNS failure, timeout, body died mid-read | **504** | the client's own, naming the gateway | — |
| The gateway answered 2xx with a body the client cannot use | **502** | the client's own | — |

The gateway relays SpaceTraders' status, body and content-type verbatim, so
"the gateway's status" is usually the game's own. Both are facts the client did
not observe and cannot improve on.

**Pacing headers travel too.** The gateway goes out of its way to forward
`Retry-After` and the `X-RateLimit-*` trio on a passed-through 429 — a client
that relays the status without them keeps the news and drops the instructions.

**500 characters.** An error message is read by a person; echoing a megabyte of
someone else's HTML error page through three service logs is not diagnosis. The
cap had drifted to 64 KiB in one service and 500 characters in another.

**What counts as an unusable 2xx is each client's own business.** navigation-
service requires the game's `data` envelope; fleet-service treats an empty body
as an empty result. That is a judgement about the payload each of them consumes,
not about the failure, and this document does not unify it.

## Why relaying, rather than each service deciding

The three clients had drifted into three different answers for the same
upstream condition:

| condition | agent-service (Go) | fleet-service (TS) | navigation-service (Java) |
|---|---|---|---|
| upstream 4xx | status kept | status kept | status kept |
| upstream 5xx | status kept | status kept | **collapsed to 502** |
| gateway unreachable | 502 | 504 | 502 |
| error body | echoed raw into a plain-text response, 64 KiB cap | `error.message` parsed out, 500-char cap | **discarded** |
| pacing headers | dropped | dropped | dropped |

The general form of the problem: a client service has strictly less information
than the gateway. It did not talk to SpaceTraders and it cannot see whether a
credential exists, so every verdict it re-decides is a guess overwriting a fact.

The concrete cost, and it is a diagnostic one rather than a behavioural one:
the gateway answers `503 SpaceTraders credential not configured`, which is the
one thing that says an operator must act rather than wait. Reached through
navigation-service that becomes a bare `502` with the sentence thrown away, and
automation-service — which classifies failures by exactly that sentence —
records it as an ordinary outage. It already documents the case as a known gap
in `gameClients.ts`: *"the same behaviour, a less precise label"*. The retry
behaviour genuinely is the same; what is lost is any way to find out, from the
event log, that the fleet is stopped for a reason no amount of waiting fixes.

## The one thing a client does decide

Whether the gateway answered at all. That is genuinely the client's own
observation and nobody else's, and it is `504`: the fault is upstream of the
caller and a retry may work. Not `502`, which in this table means "the gateway
answered and I cannot use what it said" — a different problem with a different
remedy.

## Conformance

[`fixtures/gateway-errors.json`](../../fixtures/gateway-errors.json) is the
source of truth: fourteen conditions, each with the gateway response that
produces it and the answer expected. Every message string in it is quoted from
st-gateway's own source or from a real observed game error.

Each service is to **vendor that file verbatim** into its test support
directory and drive its own client through every case, with a header on the
copy naming this file as the original. Vendored rather than imported because
these are three languages in three repositories: a copied data file makes drift
visible in a diff, which a prose specification does not. Change `meta` first,
then re-copy.

Local additions belong in the service's own tests. This file holds only
conditions every client must answer identically.

**A case must not be satisfiable by an empty answer.** `oversized-error-body`
asserted only a status and a maximum length, which an empty message meets
perfectly — a reviewer found it by deleting the message from a client and
watching the case stay green. Every case that bounds a message now also asserts
there is one. The same trap is available to any future case that asserts only an
upper bound.

## What this does not standardise, and what that costs

The **outward** envelope each service presents to its own callers.
agent-service answers plain text, fleet-service `{"error":{"message"}}`, and
navigation-service RFC 9457 problem+json (whose field is `detail`, not
`message`). Unifying those is a change to three public contracts with a
dashboard in front of them, and a separate decision.

Two consequences worth being explicit about, because relaying the message is
most of the point of this document:

- **SpaceTraders' numeric `code` is deliberately not part of the contract.**
  It survives the gateway, and it is tempting as the machine-readable
  discriminator a message string is not. But it cannot be relayed *as a field*
  through a plain-text response or a `ProblemDetail`, so promising it here would
  promise the envelope change this document declines to make. It also would not
  help the case above: the gateway's own errors — including both 503s — carry
  no code at all.
- **command-interface cannot yet display two of the three.** Its
  `parseErrorMessage` reads `body.error.message`, `body.error` and
  `body.message` — none of which match a `ProblemDetail`'s `detail` or a
  plain-text body. So the sentence this document preserves reaches the operator's
  screen from fleet-service and nowhere else. Worth fixing there, and cheap: two
  more fallbacks.
