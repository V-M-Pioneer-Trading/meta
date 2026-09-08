# What a service answers when st-gateway doesn't

Normative for agent-service, fleet-service and navigation-service — the three
services that call SpaceTraders through st-gateway. automation-service consumes
what they answer and classifies it; it is the reason this document exists.

## The rule

**st-gateway already decided what went wrong. Relay its answer.** A client
service classifies exactly one condition — "the gateway did not answer me" —
and relays every other. Everything the gateway says about the game, about the
credential, or about the caller is already the right answer, and re-deciding it
throws information away that nothing downstream can recover.

| Condition | Status | Body |
|---|---|---|
| The gateway answered non-2xx | **its status, unchanged** | `{"error":{"message": <its message>, "code": <its code, if any>}}` |
| The gateway did not answer — connection refused, DNS failure, timeout, body died mid-read | **504** | the client's own message, naming the gateway |
| The gateway answered 2xx with something unusable — not JSON, or missing the `data` envelope | **502** | the client's own message |

`message` comes from the gateway's own `{"error":{"message"}}` envelope when
there is one, and from the raw body (truncated) when there isn't — a proxy
between the client and the gateway can answer with HTML, and losing that
entirely leaves an operator with a bare status and nothing to search for.

`code` is SpaceTraders' own numeric error code, which the gateway passes
through and all three clients used to drop. It is the only machine-readable
thing in the envelope: without it, "the ship is on cooldown" and "the ship is
in the wrong state" are two English sentences, and every consumer that needs to
tell them apart is reduced to matching on prose.

## Why relaying, rather than each service deciding

The three clients had drifted into three different answers for the same
upstream condition:

| condition | agent-service (Go) | fleet-service (TS) | navigation-service (Java) |
|---|---|---|---|
| upstream 5xx | status kept | status kept | **collapsed to 502** |
| unreachable | raw error | 504 | 502 |
| error body | raw, 64 KiB cap | parsed, 500-char cap | **discarded** |
| SpaceTraders `code` | dropped | dropped | dropped |

Two live consequences, both found rather than imagined:

- **A missing game credential is invisible through navigation-service.** The
  gateway answers `503 SpaceTraders credential not configured`, which is the
  one thing that says an operator must act. Collapsed to a `502`, it is
  indistinguishable from a transient outage, and automation-service's failure
  classifier — which reads exactly that sentence — sees a retryable blip for as
  long as it lasts (automation-service#21).
- **A caller's own expired session reads as a broken fleet.** A `401` from the
  gateway, collapsed to `502`, tells the dashboard the backend is down when the
  user simply needs to sign in again.

The general form: a client service is not in a position to improve on the
gateway's verdict. It has strictly less information — it did not talk to
SpaceTraders, and it cannot see the credential — so every re-decision it makes
is a guess that overwrites a fact.

## The one thing a client does decide

Whether the gateway answered at all. That is genuinely the client's own
observation and nobody else's, and it is `504`: the fault is upstream of the
caller and a retry may work. Not `502`, which in this table means "the gateway
answered and I cannot use what it said" — a different problem with a different
remedy.

## Conformance

[`fixtures/gateway-errors.json`](../../fixtures/gateway-errors.json) is the
source of truth. Each service **vendors that file verbatim** into its test
support directory and drives its own client through every case.

Vendoring rather than importing, because these are three languages and three
repositories; a copied data file makes drift visible in a diff, which a
prose specification does not. Change `meta` first, then re-copy — and the copies
carry a header saying so.

Local additions belong in the service's own tests, not in the shared file: this
one holds only conditions every client must answer identically.

## What this does not standardise

The **outward** error envelope each service presents to its own callers.
agent-service answers plain text, fleet-service `{"error":{"message"}}`, and
navigation-service RFC 9457 problem+json. That divergence is real and worth
closing, but it is a change to three public contracts with a dashboard in front
of them, and it is not what this document is about: here, only the *status* and
the *message and code carried into it* must match.
