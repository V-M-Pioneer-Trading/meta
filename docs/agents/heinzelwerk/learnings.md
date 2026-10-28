# Agent learnings

Curated by tech-lead at the end of each team run, merged by a human. Max 80 lines. Hard-to-reverse decisions go to `docs/adr/`, terms to `GLOSSARY.md`. This file holds the rest.

<!-- format: - **<warning|discovery|codebase>** (#<ticket> | adopted: <path>): <one line> -->

- **codebase** (adopted: meta/docs/design/token-introspection.md): the center's 401 means our caller secret is wrong; answer 503, never 401 (UI loops on sign-in) or 403 (automation-service stops for good).
- **warning** (adopted: meta/docs/design/token-introspection.md): CloudFront collapses duplicate Authorization lines, so the two-line rule cannot be tested through the public domain.
- **codebase** (adopted: meta/docs/design/upstream-errors.md): a client decides only 504 (gateway unreachable); a 502 means the gateway answered and its body was unusable.
- **codebase** (adopted: meta/docs/design/upstream-errors.md): relay the pacing headers on every error answer; all three clients once dropped them.
- **codebase** (adopted: meta/docs/algorithms.md): a new backend calling st-gateway must forward the inbound Authorization unchanged, or its calls silently drop to the background lane.
- **codebase** (adopted: meta/docs/design/autopilot-design.md): a running task is never preempted; a replan touches only idle or finishing ships; abort is the only interrupt.
- **warning** (adopted: meta/docs/design/autopilot-spec.md): knob writes are last-writer-wins between the UI and ai-service; the event log is the only audit trail.
- **warning** (adopted: meta/docs/design/auth-design.md): Clerk restricted mode admits nobody through the allowlist; only existing users or invitees can sign in.
- **warning** (adopted: meta/docs/design/auth-design.md): services fail closed without their auth env; the apply that provides it must land before the deploy, or the service crash-loops.
- **warning** (adopted: meta/docs/operations.md): CloudFront answers unknown paths with index.html and 200, so a missing route looks like a page; check the content-type.
- **warning** (adopted: meta/docs/operations.md): "Failed to fetch" at sign-in with green health checks means a backend lacks Authorization in its CORS allow-headers, or a stale command-interface `.env.local`.
- **warning** (adopted: infrastructure/README.md): AWS CLI v1 `ssm put-parameter --value https://...` fetches the URL and stores the response; use CLI v2.
- **warning** (adopted: infrastructure/README.md): PowerShell's `$Error` keeps a failed request's URI, Telegram bot token included; run `$Error.Clear()` after a failed call.
- **warning** (adopted: infrastructure/README.md): rotating a Machine key revokes the old value at once; rerun the auth bootstrap before the token cache expires, and never share a key between callers.
- **warning** (adopted: infrastructure/README.md): `-var` values for the anomaly webhook format and chat id last one apply; the next plain apply reverts them.
- **warning** (adopted: auth-service/README.md): never delete `/data/auth.db` to fix a deploy; it holds the only copy of the agent token.
- **codebase** (adopted: agent-service/contract/README.md): the contract suite runs `.ts` through Node type stripping: erasable syntax only (no enums, parameter properties, namespaces).
- **codebase** (adopted: agent-service/README.md): an upstream 401 has the same status as an invalid session; read the body to tell them apart.
- **warning** (adopted: auth-service/contract/README.md): an unknown JWT `crit` header was accepted by the Go service and is rejected by the port; the suite deliberately leaves it unpinned.
- **codebase** (adopted: clerk-client/README.md): set `server.maxHeadersCount` before the first connection; later changes miss open keep-alive connections.
- **codebase** (adopted: clerk-client/README.md): after a refresh failure other than unknown-caller, the cached machine token is served until expiry, and 503/401 answers are never retried.
- **codebase** (adopted: clerk-client/README.md): `requireScope` throws for "none", "session" and "ignore-credentials"; a resolver returning them is undeclared (500).
- **codebase** (adopted: navigation-service/README.md): markets and shipyards are never evicted, and the first system listing walks every upstream page inside one request.
- **warning** (adopted: navigation-service/README.md): CI builds the image only on a push to main, so a Dockerfile-only change is unverified until merge.
