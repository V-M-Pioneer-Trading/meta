# Calling services relay st-gateway's answer

st-gateway already decided what went wrong, so a calling service relays its answer: the gateway's status unchanged, its message, and its `Retry-After` / `X-RateLimit-*` headers. The calling service classifies exactly one condition itself, "the gateway did not answer me", as 504 (and a 2xx body it cannot use as 502), see `../fleet-service/src/spacetraders/client.ts:85-94`, `../agent-service/src/controllers/agent.controller.ts:15,22`.

Source: docs/design/upstream-errors.md#The rule
