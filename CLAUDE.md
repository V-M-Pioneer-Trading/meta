## Agent skills (heinzelwerk)

- **Precedence**: for heinzelwerk team work, these pointers override any other agent-skills block in this file.
- **Issue tracker**: GitHub issues in this repo, the tracker for the whole workspace. See `docs/agents/heinzelwerk/issue-tracker.md` before creating, reading, or labelling issues.
- **Triage labels**: the five canonical labels, defined here. See `docs/agents/heinzelwerk/triage-labels.md` before applying any label.
- **Domain docs**: multi-context workspace, one context per repo; map in `GLOSSARY-MAP.md`, this repo's glossary `GLOSSARY.md`. Read `docs/agents/heinzelwerk/domain.md` before exploring code or naming anything.
- **Team rules**: read `docs/agents/heinzelwerk/team.md` before any team task.
- **Out of scope**: see `docs/agents/heinzelwerk/out-of-scope.md` before proposing or triaging discovered work.
- **Workspace**: read `docs/agents/heinzelwerk/workspace.md` before any cross-repo task.
- **Repo map**: see `docs/agents/heinzelwerk/repo-map.md` when locating code.
- **Learnings**: read `docs/agents/heinzelwerk/learnings.md` before starting any task.
- **Sibling paths** (workspace mode only): `../<repo>/…` above is relative to this repo's main checkout, i.e. the workspace folder. From a task worktree (`.claude/worktrees/<x>`), resolve it as `$(cd "$(git rev-parse --git-common-dir)/../.." && pwd)/<repo>/…`.
