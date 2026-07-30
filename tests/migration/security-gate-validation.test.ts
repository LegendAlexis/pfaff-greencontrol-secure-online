import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const runner = fileURLToPath(
  new URL("scripts/database/invoke-security-gate-test.ps1", root),
);
const preflightUrl = new URL(
  "scripts/database/security-gate-preflight.sql",
  root,
);
const postflightUrl = new URL(
  "scripts/database/security-gate-postflight.sql",
  root,
);

function run(arguments_: string[]) {
  return spawnSync(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      runner,
      ...arguments_,
    ],
    { encoding: "utf8" },
  );
}

const safeArguments = [
  "-TargetHost",
  "db.disposable-test.invalid",
  "-TargetProjectRef",
  "disposable-test-ref",
  "-ProductionHost",
  "db.production.invalid",
  "-ProductionProjectRef",
  "production-ref",
  "-DatabaseUser",
  "postgres.disposable-test-ref",
];

test("runner refuses execution without explicit disposable-test switch", () => {
  const result = run(safeArguments);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ExecuteOnDisposableTest/i);
});

test("runner refuses either matching production identity", () => {
  for (const [host, projectRef] of [
    ["db.production.invalid", "disposable-test-ref"],
    ["db.disposable-test.invalid", "production-ref"],
  ]) {
    const arguments_ = [...safeArguments];
    arguments_[arguments_.indexOf("db.disposable-test.invalid")] = host;
    arguments_[arguments_.indexOf("disposable-test-ref")] = projectRef;
    arguments_.push("-ExecuteOnDisposableTest");

    const result = run(arguments_);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /production identity/i);
  }
});

test("validation SQL contains only the approved security scope", async () => {
  const [preflight, postflight] = await Promise.all([
    readFile(preflightUrl, "utf8"),
    readFile(postflightUrl, "utf8"),
  ]);
  const sql = `${preflight}\n${postflight}`;

  assert.match(sql, /public\.profiles/i);
  assert.match(sql, /public\.manual_commands/i);
  assert.doesNotMatch(
    sql,
    /^\s*(insert|update|delete|truncate|alter|grant|revoke)\b/im,
  );
  assert.doesNotMatch(sql, /\b(organizations|sites|tenant)\b/i);
});

test("postflight proves denial and preserves baseline functions", async () => {
  const postflight = await readFile(postflightUrl, "utf8");

  for (const column of ["system_role", "is_active", "mfa_required"]) {
    assert.match(postflight, new RegExp(`'${column}'`, "i"));
  }

  assert.match(postflight, /manual_commands_policies <> 0/i);
  assert.match(postflight, /required_functions <> 5/i);
  assert.match(postflight, /required_triggers <> 2/i);
  assert.match(postflight, /has_sequence_privilege/i);
});
