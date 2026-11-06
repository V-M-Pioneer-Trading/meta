# OpenAPI specs

One file per backend, `<repository>.json`, always OpenAPI 3. Nobody edits these
by hand: each backend commits its own spec, checks it is current in CI, and on
every push to its main branch calls
[`.github/workflows/openapi-sync.yml`](../.github/workflows/openapi-sync.yml),
which proposes the file here as a pull request (`openapi-sync/<repository>`)
that merges itself once `validate` passes. A Swagger 2.0 spec would be converted
to OpenAPI 3.0 on the way in; since agent-service moved to TypeScript (#103)
every service publishes OpenAPI 3.x already.

| File | Source in the backend | Regenerate there with |
|---|---|---|
| `fleet-service.json` | `openapi.json` | `npm run openapi` |
| `agent-service.json` | `openapi.json` | `npm run openapi` |
| `navigation-service.json` | `openapi.json` | see navigation-service's README |
| `auth-service.json` | `openapi.json` | `npm run openapi` |
| `automation-service.json` | `openapi.json` | `npm run openapi` |

st-gateway publishes none on purpose: `/proxy` is an opaque passthrough whose
contract is `fixtures/gateway-errors.json`, and `/health` and `/metrics` have no
typed consumer (see `docs/agents/heinzelwerk/out-of-scope.md`). auth-service's
and automation-service's specs list every route with its scope (internal
routes included); both repositories are public, so publishing them here reveals
nothing new.

**Adding a service** takes two pull requests: its own (a committed spec, a CI
check that it is current, and the caller job) and one here adding its name to
`SERVICES` in `scripts/validate-openapi.mjs`, which refuses unknown files.

**Guards.** `validate` is a required check on main. A pull request from the
App (`vmpt-openapi-sync`), or from an `openapi-sync/` branch, may only add or
modify one file, its own `openapi/<service>.json`; the service name is the calling repository's name,
never an input. The third-party converter runs on a runner that holds no
token.

The sync authenticates as an org-owned GitHub App installed on this repository
only, with Contents and Pull requests write; its Client ID and private key are
the org secrets `OPENAPI_SYNC_CLIENT_ID` and `OPENAPI_SYNC_PRIVATE_KEY`,
granted to the five calling repositories only.
