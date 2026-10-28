# Team rules

How heinzelwerk agents work in this repo, the workspace's tickets repo (see `workspace.md`). Mode rules live in the `heinzelwerk:team-modes` skill. This file holds only what is specific to this repo.

- **Autonomy**: full. Agents merge and apply on their own; breakages are learnings. Secrets are never published (name the variable, never the value), and the gate never merges its own policy.
- **Shared paths** (only the owner named in the task edits them): `fixtures/` (contract fixtures), `openapi/` (written only by `openapi-sync/*` PRs from the vmpt-openapi-sync App), `docker-compose.yml`, `scripts/`, `docs/`
- **Checks** (copied from `.github/workflows/validate.yml`, job `validate`, in order):
  - `node scripts/validate-fixtures.mjs`
  - actionlint 1.7.12 (CI only: downloads the linux_amd64 binary into `$RUNNER_TEMP`)
  - "Restrict openapi-sync pull requests to their own spec" (CI only: runs on `openapi-sync/*` PRs, reads the PR's base/head sha)
  - `node scripts/validate-openapi.mjs`
- **Checks verified on main**: cd0b1eb 2026-10-28
- **Coding standards**: none: zero-dependency Node scripts, actions pinned by full SHA with a version comment (`.github/workflows/validate.yml:20-25`)
- **Risk areas** (validator reviews diffs touching these on Opus):
  - `fixtures/**`: LF only; four repos pin the introspection fixture by sha256 and three vendor the gateway-errors fixture, so any change cascades into re-vendor tasks
  - `.github/workflows/openapi-sync.yml`: called `@main` by the deploy pipelines of agent-, auth-, fleet- and navigation-service; a broken file breaks their main runs
  - `docker-compose.yml`, `dev-keys/`: local secrets defaults and the committed dev key pair (auth-design decision 10)
  - `docs/design/*-design.md` Decisions: the workspace's ADRs; a change is a decision change
- **Contracts** (see team-modes **Contract changes**):
  - Provided: `fixtures/introspection.json` (vendored by clerk-client, auth-service, navigation-service, st-gateway), `fixtures/gateway-errors.json` (vendored by agent-service, fleet-service, navigation-service), `.github/workflows/openapi-sync.yml` (reusable workflow) · provider meta
  - Mirrored: `openapi/{agent,auth,fleet,navigation}-service.json` · provider the service repo; meta only validates
