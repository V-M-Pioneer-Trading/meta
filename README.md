# SpaceTraders — meta

Project-wide docs and local-dev orchestration for the SpaceTraders mining POC.
Cross-cutting/organization-wide issues that don't belong to a single service also live here.

## Services

| Repo | Language | Owns |
|------|----------|------|
| [navigation-service](https://github.com/V-M-Pioneer-Trading/navigation-service) | Java / Spring Boot | Waypoints, systems, market, shipyard (read + cache) |
| [agent-service](https://github.com/V-M-Pioneer-Trading/agent-service) | Go | Agent profile, ship list/detail (read), contracts (read + accept/fulfill + delivery history) |
| [fleet-service](https://github.com/V-M-Pioneer-Trading/fleet-service) | Node/TS | Ship actions: orbit, dock, navigate, extract, survey, refuel, sell, cargo, cooldown, deliver-contract |
| [command-interface](https://github.com/V-M-Pioneer-Trading/command-interface) | React | Frontend (LCARS-themed POC UI) |

```
command-interface (browser)
    │  Authorization: Bearer <token>  (pasted in once, held client-side)
    ├──────────────► navigation-service   (waypoints / market / shipyard)
    ├──────────────► agent-service        (agent / ships / contracts)
    └──────────────► fleet-service        (ship actions) ──► agent-service
                                                              (records contract deliveries)
```

## Design decisions

- **Auth**: no service stores a SpaceTraders token. Every request carries the caller's
  `Authorization: Bearer <token>` header, forwarded upstream as-is. The frontend's "login" is
  just pasting an already-obtained token — there's no `/register` (new-agent-creation) flow in
  this POC.
- **Service boundaries**: read-only location data (waypoints/systems/market/shipyard) lives in
  navigation-service. Agent/ship/contract *reads* plus contract accept/fulfill and delivery
  history live in agent-service. All ship *actions* (anything that moves a ship or its cargo)
  live in fleet-service, which is stateless and calls SpaceTraders directly — except
  deliver-contract, which also calls agent-service afterward to record delivery history.
- **POC gameplay scope** (single system, mining loop only): orbit, dock, navigate, extract,
  survey, extract-with-survey, refuel, sell-cargo, purchase-cargo, transfer-cargo, patch-nav
  (flight mode), cooldown, cargo, accept/fulfill/deliver contract. Explicitly out of scope for the
  POC: siphon, jettison, jump, warp, scan-*, mounts/modules install-remove, repair, scrap,
  purchase-ship.
- **Map rendering**: no backend aggregation endpoint. The frontend fetches waypoints from
  navigation-service and ship positions from agent-service and merges them client-side for a
  single-system view.
- **Rate limiting**: not yet handled — see
  [issue #1](https://github.com/V-M-Pioneer-Trading/meta/issues/1). All three services call
  SpaceTraders independently today; expect 429s once more than one is exercised concurrently.

## Running everything locally

Requires all four repos checked out as siblings:

```
spacetraders/
├── agent-service/
├── navigation-service/
├── fleet-service/
├── command-interface/
└── meta/            ← this repo
```

From `meta/`:

```bash
docker compose up --build
```

Starts:
- `agent-service` on http://localhost:8080 (MySQL-backed)
- `navigation-service` on http://localhost:8081 (SQLite-backed)
- `fleet-service` on http://localhost:3001 (stateless)

Then run `command-interface` separately (`npm start`, defaults to http://localhost:3000) and
point it at the three URLs above.

Each service exposes its own OpenAPI/Swagger UI:
- navigation-service: http://localhost:8081/swagger-ui.html
- agent-service: http://localhost:8080/swagger/index.html
- fleet-service: http://localhost:3001/swagger

## Production deployment

Pending infrastructure apply (Terraform is written and PR'd, not yet applied — see the PR
list below). Once live, the whole stack is reachable at
[spacetraders.radomskyi.com](https://spacetraders.radomskyi.com):

```
                    spacetraders.radomskyi.com (CloudFront, one distribution)
                              │
        ┌───────────┬─────────┴──────────┬──────────────────┐
        │            │                    │                  │
   default (*)   /api/v1/*           /api/agent/*        /api/fleet/*
        │            │                    │                  │
        ▼            ▼                    ▼                  ▼
  S3 (command-   navigation-service   agent-service      fleet-service
   interface's                    (shared EC2 host, --network host, each behind its own
   Vite build)                     security-group rule scoped to CloudFront's IP range)
                                              │
                                        agent-service's MySQL
                                     (same host, own EBS volume)
```

- Backend hosting: `V-M-Pioneer-Trading/infrastructure` — `navigation-service/`, `agent-service/`,
  `fleet-service/` Terraform stacks, each SSM-bootstrapped onto one shared EC2 host.
- Frontend hosting + routing: `mradomsky/infrastructure` — `projects/spacetraders/` stack (S3 +
  CloudFront + ACM + Route53).
- Deploy: every service auto-deploys on merge to main (CI pushes the image, then triggers an SSM
  redeploy on the host). command-interface auto-deploys via S3 sync + CloudFront invalidation.
- GHCR images are public for all three backends (no registry auth needed to pull).
