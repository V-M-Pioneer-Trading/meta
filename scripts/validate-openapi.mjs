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
 *   5. the file name is a lowercase repository name.
 *
 * Zero dependencies and plain node, like validate-fixtures.mjs.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "openapi");
const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
for (const file of files) {
  if (!/^[a-z0-9-]+\.json$/.test(file)) fail(file, "name must be <lowercase-repository-name>.json");
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
  }
}

if (errors.length > 0) {
  for (const e of errors) console.error(`openapi: ${e}`);
  process.exit(1);
}
console.log(`openapi: ${files.length} spec(s) valid`);
