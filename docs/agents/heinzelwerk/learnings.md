# Agent learnings

Curated by tech-lead at the end of each team run, merged by a human. Max 80 lines. Hard-to-reverse decisions go to `docs/adr/`, terms to `GLOSSARY.md`. This file holds the rest.

<!-- format: - **<warning|discovery|codebase>** (V-M-Pioneer-Trading/meta#<ticket>): <one line> -->

- **warning** (adopted: agent-service/README.md, infrastructure/README.md): a rollback by image tag is not sticky; the next merge to main or infra apply redeploys. Check main's deploy is idle first.
- **warning** (adopted: auth-service/README.md): never delete `auth.db` to fix a deploy; it is the only copy of the agent token. Recover with Restore Token or Reset Agent.
- **warning** (adopted: auth-service/README.md): an unset or empty `M2M_CALLER_SECRET_*` silently disables that caller (401), not a startup error.
- **warning** (adopted: auth-service/README.md): the auth-service image is distroless, no shell; use `docker inspect` and `docker logs`, not `docker exec`.
- **warning** (adopted: st-gateway/README.md): a rotated `AUTH_INTROSPECTION_SECRET` quietly drops every operator into the background lane; only one warn line a minute shows it.
- **warning** (adopted: auth-design.md, Increment 2): app code does not provision a new required env var; apply infra first. CI green is not prod healthy.
- **warning** (adopted: auth-design.md decision 9): host iptables guards target auth-service's /32, never the subnet; a subnet DROP caused the 2026-08-23 outages.
- **warning** (adopted: auth-design.md decision 4): scope claims come from Clerk `public_metadata` only; `unsafe_metadata` is user-writable.
- **warning** (adopted: automation-service/README.md): `planner:advise` lets an operator write `model` and `alert` knobs too (the fence keys on `kind`); never grant it to a narrower account.
- **warning** (adopted: operations.md): a backend whose CORS omits `Authorization` shows only "Failed to fetch" while its health checks stay green.
- **warning** (adopted: operations.md): CloudFront answers unknown paths with 200 `index.html`; check content-type, not status.
- **warning** (adopted: operations.md): a st-gateway deploy re-runs agent-service's bootstrap, restarting agent-service and its MySQL.
- **warning** (adopted: operations.md, auth-design.md decision 21): when auth-service is down, public GETs that carry a token answer 503 too.
- **warning** (adopted: algorithms.md): a backend that does not forward `Authorization` to st-gateway silently drops to the background lane.
- **discovery** (adopted: token-introspection.md): Node keeps only the first `Authorization` header; count lines from `rawHeaders`. CloudFront collapses duplicates, so test that from the host.
- **codebase** (adopted: automation-service/README.md): replay re-scores only the choice between asteroid fields; zero flips says nothing about contract or scout decisions.
- **codebase** (adopted: agent-service/contract/README.md #33): `shipSymbol` and contract id compare case- and accent-insensitively under MySQL collation; leave filtering to SQL.
- **codebase** (adopted: clerk-client README, CHANGELOG): the README describes main (fixture v7); the 2.0.1 release that agent, automation, fleet and st-gateway pin conforms to v6. ai-service pins the older introspection-client 1.2.0.
- **warning** (adopted: auth-design.md, Increment 1): Clerk restricted mode ignores the allowlist; a zero-user instance needs sign-up opened briefly to bootstrap.
