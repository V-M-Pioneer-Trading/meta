# Team rules

How heinzelwerk agents work in this repo. Mode rules (single repo vs workspace) live in the `heinzelwerk:team-modes` skill. This file holds only what is specific to this repo.

- **Role**: tickets repo and docs (design records, glossary, local-dev compose, OpenAPI copies, conformance fixtures)
- **Backend paths**: `scripts/`, `tools/swagger2openapi/` (used by `openapi-sync.yml`), `.github/workflows/`, `docker-compose.yml`, `dev-keys/`
- **Shared paths** (only the owner named in the task edits them): `openapi/*.json` (written by the `vmpt-openapi-sync` bot from each service's main), `fixtures/*.json`
- **Checks** (validator runs every one, in order):
  1. `node scripts/validate-fixtures.mjs`
  2. `node scripts/validate-openapi.mjs`
  3. `actionlint` 1.7.12 over `.github/workflows/` (CI's "Lint the workflows" step downloads it sha-pinned; locally run it if installed, else rely on CI and say so)
- **Security**: no secret scan runs yet: gitleaks is not installed and no pre-commit hook exists (planned: `gitleaks git --pre-commit --staged` in `.git/hooks/pre-commit`), so check every diff for secrets by eye. `dev-keys/` holds a committed local-only private key on purpose (see `dev-keys/README.md`); once the hook exists, a commit touching that key trips it and a human commits it with `--no-verify`
- **Coding standards**: none written for scripts: smell baseline only
- **Risk areas** (validator reviews diffs touching these on Opus):
  - `fixtures/*.json`: every client is tested against them; a change ripples to seven vendored copies in six repos
  - decisions in `docs/design/*-design.md`: settled; a change reopens an ADR
  - `.github/workflows/openapi-sync.yml`: a reusable workflow every backend calls on push to main, with a GitHub App token that auto-merges its PRs
  - `docker-compose.yml` secrets defaults: local-only values; real secrets never land here
- **Contracts**:
  - `fixtures/gateway-errors.json`: provider meta; vendored in agent-service (sha256-pinned), fleet-service, navigation-service; each copy differs only in its `$comment` line
  - `fixtures/introspection.json`: provider meta; vendored byte-identical and sha256-pinned in auth-service, navigation-service, st-gateway, clerk-client
  - `docs/design/token-introspection.md`, `docs/design/upstream-errors.md`: the written contracts behind those fixtures
  - `openapi/*.json`: downstream copies; the provider is each service's own `openapi.json`
