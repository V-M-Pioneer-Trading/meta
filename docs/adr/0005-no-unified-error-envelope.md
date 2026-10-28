# No unified outward error envelope

Services answer errors in different shapes (plain text, `{"error": ...}`, problem+json) and the SpaceTraders numeric error code stays out of every contract; only the status, message and pacing headers of an st-gateway failure are relayed. Unifying the envelope would touch every service and every client at once for little gain, so clients parse the shapes they meet instead.

Source: `docs/design/upstream-errors.md#What this does not standardise, and what that costs`; agent-service `README.md#Known limitations`
