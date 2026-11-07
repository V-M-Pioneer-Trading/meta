# Out of scope

Proposals this project turned down for a reason that outlives one run. Tech-lead and product read it before triaging a proposal; retro reads it for rows whose `revisit when` has fired. A row is an answer, not a ban: when its condition holds, propose the work again and say so.

Rows come from tech-lead's docs PR at the end of a run (its own rejected proposals, product's `out` decisions) and from `/heinzelwerk:shape` when a spec's out-of-scope section settles something for good. `revisit when` is a condition (a ticket closed, a dependency available, a metric crossed), never `never`: a rule that must always hold is an ADR.

| proposal | rejected by | reason | revisit when |
|---|---|---|---|
| st-gateway publishes an OpenAPI spec | product (shaping meta#102, 2026-11-05) | `/proxy` is an opaque passthrough whose contract is `fixtures/gateway-errors.json`; `/health` and `/metrics` have no typed consumer | a service parses `/metrics`, or st-gateway gains routes of its own beyond health, metrics and proxy |
| command-interface validates response bodies at runtime (zod or similar) | product (shaping meta#155, 2026-11-07) | the generated clients type the bodies at compile time; a runtime check adds a dependency and code per route. The drift check compares spec copies only: a service answering differently from its own spec stays green, and that gap is accepted because each tsoa backend's spec comes from the same source as its routes | a response-shape bug reaches production despite a green drift check |
| command-interface generated clients for auth-service and st-gateway | product (shaping meta#155, 2026-11-07) | the dashboard only health-checks them; no typed call site to protect | command-interface calls an auth-service or st-gateway route beyond `/health` |
| auto-merging command-interface's spec refresh PR | product (shaping meta#155, 2026-11-07) | its diff is a type change the UI must still compile against and a human should read | the refresh PR has merged unchanged for a sustained stretch and its checks cover compile and tests |
| navigation-service validates the bodies it serves against its spec models at runtime | product (spec gate meta#172, 2026-11-07) | the service is a pass-through cache; checking upstream bodies (and rows cached under older upstream versions) would turn an upstream addition or an old row into an error, for no consumer that asked for it. The `api/schema` records are documentation only | a consumer bug traces to a navigation-service body that differs from its spec |
