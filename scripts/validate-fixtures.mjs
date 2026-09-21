#!/usr/bin/env node
/**
 * @file Structural checks on fixtures/introspection.json.
 *
 * The fixture is the source of truth for five implementations across three
 * languages, and every one of them vendors it verbatim. A typo here is a typo
 * in all of them at once, and the expensive kind of typo is the silent one: a
 * message that does not match `contract.messages` byte for byte, a `scopes`
 * list that disagrees with the `scope` string the center is stubbed to return,
 * a key nobody's suite knows how to assert. Each of those is a case that
 * passes everywhere while testing less than it claims — which is exactly what
 * meta#79 recorded.
 *
 * So this checks the things a conformance suite structurally cannot:
 *
 *   1. the file parses, and holds LF line endings only;
 *   2. case names are unique, within each group and across both;
 *   3. every `expect.message` is a value of `contract.messages`, paired with
 *      the status that message is defined to carry;
 *   4. `expect.centerCalls === 0` if and only if `center.notCalled` is true;
 *   5. `expect.identity.scopes` is the center body's `scope`, split the way
 *      every verifier splits it — on whitespace RUNS, empties discarded;
 *   6. `route`, `request`, `center` and `expect` carry known keys only;
 *   7. every case has a non-empty `why`.
 *
 * Zero dependencies and plain node, so it runs in CI with no install step and
 * on a checkout with no node_modules. Exit 0 says nothing is wrong; exit 1
 * prints every problem found, not just the first — a reviewer fixing one
 * should see the rest in the same run.
 *
 *   node scripts/validate-fixtures.mjs [path ...]
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const DEFAULT_FIXTURES = [join(REPO, "fixtures", "introspection.json")];

/**
 * Which HTTP status each of the five sentences is defined to carry.
 *
 * This is the pairing the message names mean: `missingToken` is a 401 and
 * nothing else, `missingScope` is a 403 and never a 401 (re-authenticating
 * against a valid session only loops). A case that answered 403 with the
 * missing-token sentence would read as plausible prose and be wrong in a way
 * no single implementation's suite would catch, because each one asserts only
 * that it matches the fixture.
 *
 * `invalidSession` is the one message that is not unique to a status in
 * principle, but it is a 401 in every case here and a second status for it
 * would be a decision, not a typo — so it is pinned too, and widening it is an
 * edit to this file that a reviewer will see.
 */
const STATUS_FOR_MESSAGE = {
  missingToken: 401,
  invalidSession: 401,
  missingScope: 403,
  undeclaredRoute: 500,
  centerUnavailable: 503,
};

const KNOWN_ROUTE_KEYS = new Set(["method", "requires"]);
const KNOWN_REQUEST_KEYS = new Set(["authorization"]);
const KNOWN_CENTER_KEYS = new Set([
  "notCalled",
  "status",
  "body",
  "delayMs",
  "transport",
]);
const KNOWN_EXPECT_KEYS = new Set([
  "outcome",
  "identity",
  "centerCalls",
  "centerRequest",
  "status",
  "message",
  "messageMustNotContain",
  "maxElapsedMs",
  "lane",
]);
const KNOWN_CASE_KEYS = new Set([
  "name",
  "why",
  "route",
  "request",
  "center",
  "expect",
]);

/** The whitespace-RUN split, matching strings.Fields, /\s+/ and \s+. */
const splitScopes = (scope) => scope.split(/\s+/).filter((s) => s.length > 0);

const isObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Collects problems so one run reports all of them. */
class Problems {
  constructor(label) {
    this.label = label;
    this.list = [];
  }
  add(where, message) {
    this.list.push(`${this.label}: ${where}: ${message}`);
  }
  get ok() {
    return this.list.length === 0;
  }
}

const checkKnownKeys = (problems, where, value, known, what) => {
  if (!isObject(value)) return false;
  for (const key of Object.keys(value)) {
    if (!known.has(key)) {
      problems.add(
        where,
        `unknown ${what} key "${key}" — no suite knows how to assert it, so it would be silently skipped`
      );
    }
  }
  return true;
};

/**
 * The scope the center is stubbed to hand back for this case, or undefined
 * when the case does not stub a parseable active body.
 */
const stubbedScope = (center) => {
  if (typeof center.body !== "string") return undefined;
  let parsed;
  try {
    parsed = JSON.parse(center.body);
  } catch {
    // A deliberately malformed body is a case in its own right, not an error.
    return undefined;
  }
  if (!isObject(parsed) || parsed.active !== true) return undefined;
  return typeof parsed.scope === "string" ? parsed.scope : undefined;
};

const checkCase = (problems, group, testCase, messageValues) => {
  const name =
    isObject(testCase) && typeof testCase.name === "string"
      ? testCase.name
      : "<unnamed>";
  const where = `${group}[${name}]`;

  if (!isObject(testCase)) {
    problems.add(where, "a case must be an object");
    return;
  }
  checkKnownKeys(problems, where, testCase, KNOWN_CASE_KEYS, "case");

  if (typeof testCase.name !== "string" || testCase.name.length === 0) {
    problems.add(where, "name must be a non-empty string");
  }

  // 7. Every case says why it exists. A case with no reason is a case nobody
  //    can tell is still needed, and meta#79 is what happens then.
  if (typeof testCase.why !== "string" || testCase.why.trim().length === 0) {
    problems.add(where, "why must be a non-empty string");
  }

  if (testCase.route !== undefined) {
    if (!checkKnownKeys(problems, where, testCase.route, KNOWN_ROUTE_KEYS, "route")) {
      problems.add(where, "route must be an object");
    } else {
      if (typeof testCase.route.method !== "string") {
        problems.add(where, "route.method must be a string");
      }
      if (typeof testCase.route.requires !== "string") {
        problems.add(where, "route.requires must be a string");
      }
    }
  }

  if (!checkKnownKeys(problems, where, testCase.request, KNOWN_REQUEST_KEYS, "request")) {
    problems.add(where, "request must be an object");
  } else if (
    testCase.request.authorization !== null &&
    typeof testCase.request.authorization !== "string"
  ) {
    problems.add(where, "request.authorization must be a string or null");
  }

  const center = testCase.center;
  if (!checkKnownKeys(problems, where, center, KNOWN_CENTER_KEYS, "center")) {
    problems.add(where, "center must be an object");
    return;
  }

  const expected = testCase.expect;
  if (!checkKnownKeys(problems, where, expected, KNOWN_EXPECT_KEYS, "expect")) {
    problems.add(where, "expect must be an object");
    return;
  }

  // 4. The call count and the stub must agree. A case stubbing a live center
  //    while expecting zero calls, or declaring `notCalled` while expecting
  //    one, is a case that cannot be run as written.
  const calls = expected.centerCalls;
  if (typeof calls !== "number" || !Number.isInteger(calls) || calls < 0) {
    problems.add(where, "expect.centerCalls must be a non-negative integer");
  } else if ((calls === 0) !== (center.notCalled === true)) {
    problems.add(
      where,
      `expect.centerCalls is ${calls} but center.notCalled is ${JSON.stringify(
        center.notCalled
      )} — centerCalls 0 and center.notCalled must be exactly the same claim`
    );
  }

  // 3. Rejections quote the contract, or they are prose.
  if (expected.outcome === "reject") {
    if (typeof expected.message !== "string") {
      problems.add(where, "a reject case must carry expect.message");
    } else {
      const key = messageValues.get(expected.message);
      if (key === undefined) {
        problems.add(
          where,
          `expect.message is not one of contract.messages: ${JSON.stringify(
            expected.message
          )}`
        );
      } else if (expected.status !== STATUS_FOR_MESSAGE[key]) {
        problems.add(
          where,
          `contract.messages.${key} is defined to carry ${STATUS_FOR_MESSAGE[key]}, but this case expects ${JSON.stringify(
            expected.status
          )}`
        );
      }
    }
  } else if (expected.outcome === "proceed") {
    if (expected.status !== undefined || expected.message !== undefined) {
      problems.add(where, "a proceed case must carry no status and no message");
    }
    // 5. The identity must be what the stubbed center actually said.
    const scope = stubbedScope(center);
    const identity = expected.identity;
    if (identity === null) {
      if (scope !== undefined) {
        problems.add(
          where,
          "expect.identity is null although the center is stubbed to answer active"
        );
      }
    } else if (!isObject(identity)) {
      problems.add(where, "expect.identity must be an object or null");
    } else if (scope === undefined) {
      problems.add(
        where,
        "expect.identity is an identity although the center is stubbed with no active body to derive it from"
      );
    } else {
      const wanted = splitScopes(scope);
      const got = identity.scopes;
      if (!Array.isArray(got) || JSON.stringify(got) !== JSON.stringify(wanted)) {
        problems.add(
          where,
          `expect.identity.scopes is ${JSON.stringify(got)} but the center's scope ${JSON.stringify(
            scope
          )} splits on whitespace runs to ${JSON.stringify(wanted)}`
        );
      }
    }
  } else if (expected.outcome !== "lane") {
    problems.add(
      where,
      `expect.outcome must be "proceed", "reject" or "lane", not ${JSON.stringify(
        expected.outcome
      )}`
    );
  }

  if (expected.outcome === "lane" && expected.status !== undefined) {
    problems.add(where, "a lane case must carry no status — the gateway never rejects");
  }
};

const validate = (path) => {
  const label = relative(REPO, path).split("\\").join("/");
  const problems = new Problems(label);

  let bytes;
  try {
    bytes = readFileSync(path);
  } catch (error) {
    problems.add("file", `cannot be read: ${error.message}`);
    return problems;
  }

  // 2 (line endings). Five repositories vendor this file and compare it
  // against a recorded sha256. One CRLF from one editor breaks all of them.
  const cr = bytes.indexOf(0x0d);
  if (cr !== -1) {
    const line = bytes.subarray(0, cr).toString("utf8").split("\n").length;
    problems.add("file", `carries a CR at byte ${cr} (line ${line}) — LF only`);
  }

  let fixture;
  try {
    fixture = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    problems.add("file", `is not valid JSON: ${error.message}`);
    return problems;
  }

  if (!isObject(fixture.contract) || !isObject(fixture.contract.messages)) {
    problems.add("contract", "contract.messages is missing");
    return problems;
  }

  const messageValues = new Map();
  for (const [key, value] of Object.entries(fixture.contract.messages)) {
    if (!(key in STATUS_FOR_MESSAGE)) {
      problems.add(
        "contract.messages",
        `unknown message "${key}" — this script has no status defined for it, so nothing would check its pairing`
      );
    }
    messageValues.set(value, key);
  }
  for (const key of Object.keys(STATUS_FOR_MESSAGE)) {
    if (!(key in fixture.contract.messages)) {
      problems.add("contract.messages", `is missing "${key}"`);
    }
  }

  const seen = new Map();
  for (const group of ["cases", "gatewayCases"]) {
    const cases = fixture[group];
    if (!Array.isArray(cases)) {
      problems.add(group, "must be an array");
      continue;
    }
    for (const testCase of cases) {
      checkCase(problems, group, testCase, messageValues);
      // 2 (names). Across BOTH groups: a duplicate name makes one of the two
      // cases invisible in any suite that keys on it, and every suite does.
      const name = isObject(testCase) ? testCase.name : undefined;
      if (typeof name === "string") {
        const first = seen.get(name);
        if (first !== undefined) {
          problems.add(`${group}[${name}]`, `duplicate case name, already used in ${first}`);
        } else {
          seen.set(name, group);
        }
      }
    }
  }

  return problems;
};

const paths = process.argv.slice(2);
const targets = paths.length > 0 ? paths : DEFAULT_FIXTURES;

let failed = false;
for (const path of targets) {
  const problems = validate(path);
  if (problems.ok) {
    console.log(`ok  ${problems.label}`);
  } else {
    failed = true;
    for (const problem of problems.list) console.error(`FAIL ${problem}`);
  }
}

process.exit(failed ? 1 : 0);
