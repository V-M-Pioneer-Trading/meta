#!/usr/bin/env node
/**
 * Mint a local-development session token.
 *
 * Signs with the committed development keypair in `dev-keys/`, which the
 * backends trust when `CLERK_JWT_KEY` points at its public half. Produces the
 * same shape Clerk emits — RS256, `sub`, and a space-delimited `scope` claim —
 * so services run their real verification path against it.
 *
 * Never used in CI (each service generates an ephemeral pair per test run) and
 * never trusted by production. See dev-keys/README.md.
 *
 *   node scripts/mint-dev-token.mjs
 *   node scripts/mint-dev-token.mjs --scopes fleet:control --sub user_local --expires 300
 *   node scripts/mint-dev-token.mjs --raw          # token only, no "Bearer " prefix
 */

import { readFileSync } from "node:fs";
import { sign } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = join(HERE, "..", "dev-keys", "dev-only-do-not-use.key.pem");

const DEFAULT_SCOPES = ["fleet:control", "agent:reset", "universe:refresh"];

const flag = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at !== -1 && process.argv[at + 1] !== undefined ? process.argv[at + 1] : fallback;
};

const scopes = flag("scopes", DEFAULT_SCOPES.join(" ")).split(/[\s,]+/).filter(Boolean);
const sub = flag("sub", "user_localdev");
const expiresIn = Number(flag("expires", "3600"));
const raw = process.argv.includes("--raw");

if (!Number.isFinite(expiresIn)) {
  console.error("--expires must be a number of seconds");
  process.exit(1);
}

let privateKey;
try {
  privateKey = readFileSync(KEY_PATH, "utf8");
} catch {
  console.error(`Could not read ${KEY_PATH}. Run this from anywhere, but keep dev-keys/ intact.`);
  process.exit(1);
}

const b64url = (value) => Buffer.from(value).toString("base64url");
const issuedAt = Math.floor(Date.now() / 1000);

const signingInput = [
  b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "dev-only-do-not-use" })),
  b64url(JSON.stringify({ sub, scope: scopes.join(" "), iat: issuedAt, exp: issuedAt + expiresIn })),
].join(".");

const token = `${signingInput}.${sign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url")}`;

process.stdout.write(raw ? token : `Bearer ${token}`);
if (process.stdout.isTTY) process.stdout.write("\n");
