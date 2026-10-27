# Local development keeps auth on, with a committed dev keypair

There is no "auth off" mode: local compose runs every service with real token verification against a dev keypair committed in `dev-keys/`, and tokens are minted with `scripts/mint-dev-token.mjs`. A switch that disables auth would one day reach production; a committed key that only local services trust cannot.

Source: meta/dev-keys/README.md#Why this exists
