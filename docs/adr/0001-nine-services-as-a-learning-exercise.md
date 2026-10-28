# Nine services, split to learn service boundaries

The system is split into nine services across separate repositories although one or two processes would run it. The split is deliberate: the project exists to practise service boundaries, contracts and cross-repo delivery, and it accepts the cost of cross-repo changes, duplicated plumbing and contract drift. Merging services to save effort reverses that choice, so it is a decision to reopen, not a cleanup.

Source: `docs/architecture.md#Why there are nine services`
