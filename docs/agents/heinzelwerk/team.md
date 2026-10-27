# Team rules

How heinzelwerk agents work in this repo. Mode rules (single repo vs workspace) live in the `heinzelwerk:team-modes` skill. This file holds only what is specific to this repo; the workspace is described in V-M-Pioneer-Trading/meta `docs/agents/heinzelwerk/workspace.md`.

- **Autonomy**: full. Agents merge and apply on their own; breakages are learnings. Secrets are never published (name the variable, never the value), and the gate never merges its own policy.
- **Role**: tickets repo (docs, contracts)
- **Shared paths**: `openapi/**` (written only by the openapi-sync App), `fixtures/**` (provider: meta)
- **Checks** (validator runs every one, in order; copied from CI, quiet flags only):
  - `node scripts/validate-fixtures.mjs`
  - validate.yml step "Lint the workflows" (actionlint 1.7.12, validate.yml:52-61), verbatim (unverified locally: linux-only binary)
  - `node scripts/validate-openapi.mjs`
- **Checks verified on main**: cd0b1eb 2026-10-27
- **Coding standards**: `README.md`, `docs/architecture.md`, `docs/operations.md`
- **Risk areas** (validator reviews diffs touching these on Opus):
  - `fixtures/**`: sha256-pinned copies live in every service; any byte change breaks them all
  - `.github/workflows/openapi-sync.yml`: every backend calls it `@main` from its deploy run
  - `docs/design/*-design.md`: the numbered decisions are the workspace's ADRs
  - `dev-keys/`: dev-only by design; never trusted in production
  - `.github/workflows/**`: a merge to `main` deploys or releases
- **Contracts** (see team-modes **Contract changes**; validator checks every diff touching these):
  - `openapi/*.json`: mirrors of each service's spec · provider = that service
  - `fixtures/*.json` · provider meta
