#!/usr/bin/env node
/**
 * @file Structural checks on openapi/*.json (meta#26).
 *
 * Each file is one backend's spec, proposed by the openapi-sync workflow and
 * merged automatically once this passes, so this is the only gate between a
 * backend's main branch and meta's. It checks what a reader of the folder
 * relies on, not the spec's full schema:
 *
 *   1. the file parses as JSON, holds LF line endings only, ends in a newline;
 *   2. it is OpenAPI 3.x (`openapi` field), never Swagger 2.0: the sync
 *      converts 2.0 before proposing;
 *   3. `info.title` and `info.version` are non-empty strings;
 *   4. `paths` is an object with at least one path, each starting with "/";
 *   5. the file name is one of the services below: a new service is added here
 *      in the same pull request that wires its sync (see openapi/README.md);
 *   6. at least one path carries an HTTP operation;
 *   7. the file is under 2 MB, and only .json specs and the
 *      README live in the folder.
 *
 * Zero dependencies and plain node, like validate-fixtures.mjs.
 */
import { readdirSync, readFileSync, existsSync, lstatSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SERVICES = new Set(["fleet-service", "agent-service", "navigation-service"]);
const MAX_BYTES = 2_000_000;
const OPERATIONS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "openapi");
const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

const entries = existsSync(dir) ? readdirSync(dir) : [];
for (const name of entries) {
  if (name !== "README.md" && !name.endsWith(".json")) fail(name, "only <service>.json files and README.md belong in openapi/");
}
const files = entries.filter((f) => f.endsWith(".json"));
for (const file of files) {
  if (!SERVICES.has(file.slice(0, -".json".length))) fail(file, `not a known service (${[...SERVICES].join(", ")})`);
  const st = lstatSync(join(dir, file));
  if (!st.isFile()) { fail(file, "must be a regular file, not a symlink or directory"); continue; }
  if (st.size > MAX_BYTES) fail(file, `larger than ${MAX_BYTES} bytes`);
  const raw = readFileSync(join(dir, file), "utf8");
  if (raw.includes("\r")) fail(file, "contains CR; LF line endings only");
  if (!raw.endsWith("\n")) fail(file, "must end with a newline");
  let spec;
  try {
    spec = JSON.parse(raw);
  } catch (err) {
    fail(file, `does not parse: ${err.message}`);
    continue;
  }
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) {
    fail(file, "top level must be an object");
    continue;
  }
  if ("swagger" in spec) fail(file, "is Swagger 2.0; the sync converts it to OpenAPI 3 first");
  if (typeof spec.openapi !== "string" || !/^3\.\d+\.\d+$/.test(spec.openapi)) fail(file, `openapi must be "3.x.y", got ${JSON.stringify(spec.openapi)}`);
  for (const key of ["title", "version"]) {
    if (typeof spec.info?.[key] !== "string" || spec.info[key].trim() === "") fail(file, `info.${key} must be a non-empty string`);
  }
  const paths = spec.paths;
  if (paths === null || typeof paths !== "object" || Array.isArray(paths) || Object.keys(paths).length === 0) {
    fail(file, "paths must be an object with at least one path");
  } else {
    for (const p of Object.keys(paths)) if (!p.startsWith("/")) fail(file, `path ${JSON.stringify(p)} must start with "/"`);
    const hasOperation = Object.values(paths).some((item) => item && typeof item === "object" && OPERATIONS.some((m) => m in item));
    if (!hasOperation) fail(file, "no path carries an HTTP operation");
  }
}

if (errors.length > 0) {
  for (const e of errors) console.error(`openapi: ${e}`);
  process.exit(1);
}
console.log(`openapi: ${files.length} spec(s) valid`);
