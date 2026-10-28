# An undeclared scope on a mutating route answers 500, not 403

A mutating route with no declared requirement is a server bug, so the guard answers 500 instead of the 403 a reader would expect. automation-service reads a 403 as a terminal credentials verdict and stops retrying, so a 403 here would turn a deploy mistake into a silently stuck fleet.

Source: `docs/design/token-introspection.md#The rule`
