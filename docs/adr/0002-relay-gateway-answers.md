# Calling services relay st-gateway's answer

st-gateway already decided what went wrong, so a calling service relays its answer: the gateway's status unchanged, its message, and its `Retry-After` / `X-RateLimit-*` headers. The calling service classifies exactly one condition itself, "the gateway did not answer me", as 504 (and a 2xx body it cannot use as 502), see `../fleet-service/src/spacetraders/client.ts:89,93`, `../agent-service/src/gateway/errors.ts:114,149-151`.

## Considered Options

1. Each calling service decides the upstream failure itself. Lost because a calling service has strictly less information than the gateway, so every verdict it re-decides is a guess overwriting a fact: the three clients had drifted into three different answers, and navigation-service turned the gateway's `503 SpaceTraders credential not configured` into a bare `502`, which automation-service then recorded as an ordinary outage.
2. **Relay the gateway's status, message and pacing headers (chosen).**

Source: docs/design/upstream-errors.md#The rule
Source: docs/design/upstream-errors.md#Why relaying, rather than each service deciding
