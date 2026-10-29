# Team rules

How heinzelwerk agents work in this repo. Mode rules (single repo vs workspace) live in the `heinzelwerk:team-modes` skill. This file holds only what is specific to this repo.

- **Autonomy**: full. Agents merge and apply on their own; breakages are learnings. Secrets are never published (name the variable, never the value); the gate never merges its own policy.
- **Shared paths** (only the owner named in the task edits them): `fixtures/` (conformance fixtures other repos vendor with sha pins), `openapi/` (specs the backends sync in), `.github/workflows/openapi-sync.yml` (called `@main` by four backends)
- **Checks** (validator runs every one, in order; copied from CI, quiet flags only):
  - `node scripts/validate-fixtures.mjs`
  - `actionlint` (local equivalent of the CI step, which downloads actionlint 1.7.12 into `$RUNNER_TEMP` and checks its sha256; install shellcheck first, else the local run skips the `run:` script checks (verified 2026-10-29 @ cd0b1eb: `command -v shellcheck` → not found))
  - "Restrict openapi-sync pull requests to their own spec" `(CI only: runs on openapi-sync/* pull requests or PRs by vmpt-openapi-sync[bot], .github/workflows/validate.yml:73)`
  - `node scripts/validate-openapi.mjs`
- **Verified against**: cd0b1eb 2026-10-29 (checks and every ref in this file; retro bumps it)
- **Coding standards**: none: smell baseline only. Repo rules from config: scripts are zero-dependency plain node, no `package.json` (`.github/workflows/validate.yml:31-33`); third-party actions pinned to a full SHA with a version comment (`.github/workflows/validate.yml:20-25`); LF everywhere (`.gitattributes:1`)
- **Risk areas** (validator reviews diffs touching these on Opus):
  - `fixtures/introspection.json`: vendored byte-for-byte with a sha256 pin by auth-service, navigation-service, st-gateway, clerk-client; any byte change breaks every pin; change meta first, then re-copy and update each pin file (`../navigation-service/src/test/resources/introspection/SOURCE.txt:16`). Stays `-text` (`.gitattributes:10`)
  - `fixtures/*` PRs: merge with a merge commit, never squash, and a human merges. The pins name the PR head commit, which a squash replaces (`../st-gateway/src/__tests__/fixtures/SOURCE.txt:12-16`); the gate squashes (`docs/agents/heinzelwerk/merge-policy.json:7`), so the policy denies `fixtures/*` (`docs/agents/heinzelwerk/merge-policy.json:4`). The reliable fix is V-M-Pioneer-Trading/meta#146 (verified 2026-10-29 @ cd0b1eb: `gh issue view 146 -R V-M-Pioneer-Trading/meta` → open, "Merge gate squashes fixture PRs; vendoring pins need a merge commit")
  - `fixtures/gateway-errors.json`: normative for agent-, fleet-, navigation-service, which re-copy it (`docs/design/upstream-errors.md:3-4`); agent-service pins its sha (`../agent-service/contract/fixtures/SOURCE.txt:5`)
  - `.github/workflows/openapi-sync.yml`: called `@main` by agent-, auth-, fleet-, navigation-service deploy workflows, so a broken file breaks their main runs (`.github/workflows/validate.yml:48-51`); holds the App token that pushes and auto-merges here (`.github/workflows/openapi-sync.yml:216-227`)
  - `.github/workflows/validate.yml` step "Restrict openapi-sync pull requests to their own spec" and `scripts/validate-openapi.mjs`: the only gate before a sync PR merges itself (`.github/workflows/validate.yml:63-64`); `SERVICES` allow-list (`scripts/validate-openapi.mjs:27`)
  - `dev-keys/**`: private key committed on purpose, never trusted by prod; no "auth off" path ever (`dev-keys/README.md:3-4,17-18`, `.env.example:14`)
  - `docker-compose.yml` / `.env.example` secrets: `AUTH_SERVICE_SHARED_SECRET`, `AUTH_INTROSPECTION_SECRET`, `M2M_CALLER_SECRET_*` must stay pairwise distinct, defaults included, or auth-service refuses to start (`.env.example:33-36,44`, `docker-compose.yml:20,28,225,250`)
  - `docs/design/auth-design.md` "## Decisions": the authz contract every service implements (`docs/design/auth-design.md:177`)
- **Contracts** (see team-modes **Contract changes**; validator checks every diff touching these):
  - Provided: `fixtures/introspection.json` v7 (`fixtures/introspection.json:3`) · consumers auth-service, navigation-service, st-gateway, clerk-client (vendored), agent-, fleet-, automation-service, st-gateway (via clerk-client 2.0.1 tarball), ai-service (fixture v5, via the old introspection-client 1.2.0 tarball, `../ai-service/package.json:17`)
  - Provided: `fixtures/gateway-errors.json` v1 (`fixtures/gateway-errors.json:3`) · consumers agent-service, fleet-service, navigation-service
  - Provided: reusable workflow `openapi-sync.yml` (`workflow_call`, input `spec-path`, secrets `OPENAPI_SYNC_CLIENT_ID`/`OPENAPI_SYNC_PRIVATE_KEY`; `.github/workflows/openapi-sync.yml:45-56`) · consumers agent-service, auth-service, fleet-service, navigation-service
  - Consumed: `openapi/{agent,auth,fleet,navigation}-service.json`, each proposed from the backend's committed `openapi.json` (`openapi/README.md:3-17`) · providers those four backends
  - Consumed: every service's Dockerfile, built from `../<service>` contexts (`docker-compose.yml:6,51,79,101,123,199,240`) · providers st-gateway, agent-, navigation-, fleet-, auth-, automation-service, ai-service
  - Vendored: none (meta is the source of every vendored fixture)
