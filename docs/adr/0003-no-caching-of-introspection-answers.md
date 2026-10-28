# Services never cache introspection answers

A calling service asks the center about every request and keeps no cache of its answers, even though a cache would cut latency and load on auth-service. A cache would be a second verification path and would keep honouring a revoked or expired token until it expired; one answer per request keeps revocation immediate and the center the only verifier.

Source: `docs/design/token-introspection.md#What this deliberately does not standardise`
