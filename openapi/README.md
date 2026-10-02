# OpenAPI specs

One file per backend, `<repository>.json`, always OpenAPI 3. Nobody edits these
by hand: each backend commits its own spec, checks it is current in CI, and on
every push to its main branch calls
[`.github/workflows/openapi-sync.yml`](../.github/workflows/openapi-sync.yml),
which proposes the file here as a pull request (`openapi-sync/<repository>`)
that merges itself once `validate` passes. Swagger 2.0 specs (agent-service) are
converted to OpenAPI 3.0 on the way in, so a file here can differ from what the
service serves at runtime in version, not in content.

| File | Source in the backend | Regenerate there with |
|---|---|---|
| `fleet-service.json` | `openapi.json` | `npm run openapi` |
| `agent-service.json` | `src/docs/swagger.json` (Swagger 2.0) | `go generate ./...` in `src/` |
| `navigation-service.json` | `openapi.json` | see navigation-service's README |

automation-service, auth-service and st-gateway publish no spec yet.

The sync authenticates as an org-owned GitHub App installed on this repository
only, with Contents and Pull requests write; its Client ID and private key are
the org secrets `OPENAPI_SYNC_CLIENT_ID` and `OPENAPI_SYNC_PRIVATE_KEY`.
