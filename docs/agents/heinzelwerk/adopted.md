# Adopted docs

Ledger for `heinzelwerk:adopt-docs`: one line per processed doc, `<path> @ <git hash-object>: <classes> → <destination>`. A doc whose hash changes is re-read as a diff.

- README.md @ e3f03d13f25962a0510d864b8303783a0635ca25: reference, stale (fixed: service languages) → repo-map pointer
- dev-keys/README.md @ b592d48d82912d873ed828059090bc1cda2e56dd: decision, how-to, reference → ADR 0002, repo-map pointer
- openapi/README.md @ d044c9907d07a054371d3557500aa8e295084be7: how-to, reference → repo-map pointer
- docs/algorithms.md @ fdca0adbdffb6072b9bb45560cc4e3694281a76d: terms, gotcha, reference, stale (fixed: lane derivation) → automation GLOSSARY, learnings, repo-map pointer
- docs/architecture.md @ 060c310ff8912531eef0fffd2f01d3e0590132e8: decisions (kept as reference), planned (dropped by owner), stale (fixed: languages, MCP exception, webhook, MCP 401) → repo-map pointer
- docs/operations.md @ 8c2f6d072472447af49342ff0422929143ecd6af: gotchas, reference, stale (fixed: swagger path, webhook) → learnings, repo-map pointer
- docs/design/auth-design.md @ 51ed714799ab3a7b5a26f472ed8f7c0051163a6b: decisions (already ADRs), terms, gotchas, stale (fixed: statuses 21/22/23, build order, diagram, image, auth-service language note) → GLOSSARY, learnings, repo-map pointer
- docs/design/autopilot-design.md @ ee3f8c835c4d3dcbfe6d3d79d50f8d093d57203b: decisions (already ADRs), stale (dated note) → repo-map pointer
- docs/design/autopilot-spec.md @ 98f56a575a8aad00d3595baa6225ec55d2236e83: frozen record, stale (dated note) → repo-map pointer
- docs/design/token-introspection.md @ 0bc8e3971bcd9ac84dd8a167a46145e3112c2f6f: reference, gotchas, stale (fixed: statuses) → learnings, repo-map pointer
- docs/design/upstream-errors.md @ 1cc610ce102cea6ab85523ca880a718e2f914c12: decision (kept as reference), gotcha, stale (dated note) → repo-map pointer
