import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const runner = fileURLToPath(
  new URL("scripts/database/invoke-schema-cleanup-audit.ps1", root),
);
const auditUrl = new URL(
  "scripts/database/schema-cleanup-readonly.sql",
  root,
);

const baseArguments = [
  "-TargetHost",
  "aws-0-audit.pooler.supabase.com",
  "-TargetProjectRef",
  "audit-project",
  "-DatabaseUser",
  "postgres.audit-project",
  "-ExpectedHost",
  "aws-0-audit.pooler.supabase.com",
  "-ExpectedProjectRef",
  "audit-project",
];

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

test("schema cleanup audit defaults to refusal", () => {
  const result = run(baseArguments);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires DryRun or ExecuteReadOnly/i);
});

test("schema cleanup dry-run binds one exact identity without connecting", () => {
  const result = run([...baseArguments, "-DryRun"]);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);

  assert.equal(output.mode, "dry-run");
  assert.equal(output.targetProjectRef, "audit-project");
  assert.equal(output.databaseUser, "postgres.audit-project");
  assert.equal(output.databaseName, "postgres");
  assert.equal(output.connectionAttempted, false);
  assert.equal(output.executable, false);
  assert.match(
    output.file.replaceAll("\\", "/"),
    /scripts\/database\/schema-cleanup-readonly\.sql$/,
  );
});

test("schema cleanup audit rejects every identity mismatch", () => {
  for (const [name, value] of [
    ["-TargetHost", "unexpected.pooler.supabase.com"],
    ["-TargetProjectRef", "unexpected-project"],
    ["-DatabaseUser", "postgres.unexpected-project"],
    ["-DatabaseName", "unexpected"],
  ]) {
    const arguments_ = [...baseArguments];
    const existingIndex = arguments_.indexOf(name);

    if (existingIndex === -1) {
      arguments_.push(name, value);
    } else {
      arguments_[existingIndex + 1] = value;
    }

    arguments_.push("-DryRun");
    const result = run(arguments_);

    assert.notEqual(result.status, 0);
  }
});

test("audit SQL is transactionally read-only and rolls back", async () => {
  const sql = await readFile(auditUrl, "utf8");

  assert.match(sql, /\\set ON_ERROR_STOP on/i);
  assert.match(sql, /BEGIN TRANSACTION READ ONLY;/i);
  assert.match(sql, /transaction_read_only/i);
  assert.match(sql, /ROLLBACK;/i);
  assert.doesNotMatch(
    sql,
    /^\s*(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|CALL|DO)\b/im,
  );
  assert.doesNotMatch(sql, /\bCOMMIT\b/i);
});

test("audit reports quality indicators without selecting sensitive columns", async () => {
  const sql = await readFile(auditUrl, "utf8");

  assert.match(sql, /relationship_quality/i);
  assert.match(sql, /notification_column_drift/i);
  assert.match(sql, /command_and_schedule_quality/i);
  assert.match(sql, /index_coverage_observation/i);
  assert.match(sql, /auth_user_bootstrap_trigger_count/i);
  assert.doesNotMatch(sql, /secret_hash/i);
  assert.doesNotMatch(sql, /SELECT\s+\*/i);
  assert.doesNotMatch(sql, /raw_user_meta_data/i);
});
