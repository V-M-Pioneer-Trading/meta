# TypeScript backends publish OpenAPI from tsoa controllers

A TypeScript backend writes its routes as tsoa controllers; tsoa generates the Express routes and the committed `openapi.json` from the same source, CI refuses a stale file, and the openapi-sync caller job proposes it to `openapi/` here. fleet-, agent- and auth-service work so; automation-service follows (meta#102, #152–#154).

## Considered Options

1. zod schemas plus zod-to-openapi. Lost because paths, methods and status codes still get hand-wired, so the spec can drift from what is mounted; validation stays in our hands, which is the one thing we gave up.
2. A hand-written spec kept honest by a route-comparison test. Lost because the test can compare paths, not request and response shapes.
3. **tsoa controllers (chosen).** Routes and spec from one source, so the spec cannot drift. Price: handlers must be tsoa controllers, a retrofit for a service built with plain Express, and tsoa's own validation answers must be mapped to the service's error shape.

Source: meta#102 "Implementation Decisions"
