# Glossary Map

## Contexts

- [Workspace](./GLOSSARY.md): the cross-cutting language every repo shares: identity and credentials, traffic, the autopilot
- Per-repo glossaries: none yet. Each repo is its own context; its `GLOSSARY.md` is created at its root when its first repo-specific term is resolved, and listed here.

## Relationships

- **auth-service → every service**: the center answers introspection with `kind` and scopes; services never verify a token themselves
- **st-gateway → every caller**: one shared rate budget; the lane comes from the center's answer
- **automation-service ↔ ai-service**: anomalies flow to the supervisor; the supervisor writes policy knobs and requests replans
