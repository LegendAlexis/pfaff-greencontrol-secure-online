import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const safetyScript = fileURLToPath(
  new URL("../../scripts/database/greencontrol-db-safety.ps1", import.meta.url),
);
const toolsScript = fileURLToPath(
  new URL("../../scripts/database/verify-postgres-tools.ps1", import.meta.url),
);
const forwardDraft = fileURLToPath(
  new URL(
    "../../supabase/migration-drafts/20260729_2a_multi_tenant_foundation_DRAFT.sql",
    import.meta.url,
  ),
);

const identities = [
  "-ProductionHost",
  "db.production.invalid",
  "-ProductionProjectRef",
  "production-ref",
  "-TestHost",
  "db.test.invalid",
  "-TestProjectRef",
  "test-ref",
  "-DatabaseUser",
  "postgres.test-ref",
];

function runSafety(arguments_: string[]) {
  return spawnSync(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      safetyScript,
      ...arguments_,
    ],
    { encoding: "utf8" },
  );
}

function testWriteArguments(operation = "apply-forward") {
  return [
    "-Operation",
    operation,
    "-TargetKind",
    "test-write",
    "-TargetHost",
    "db.test.invalid",
    "-TargetProjectRef",
    "test-ref",
    ...identities,
    "-InputFile",
    forwardDraft,
    "-DryRun",
  ];
}

test("valid test target produces a non-executable psql argument plan", () => {
  const result = runSafety(testWriteArguments());

  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout) as {
    dryRun: boolean;
    executionAllowed: boolean;
    tool: string;
    arguments: string[];
    passwordSource: string;
  };

  assert.equal(plan.dryRun, true);
  assert.equal(plan.executionAllowed, false);
  assert.equal(plan.tool, "psql");
  assert.equal(plan.passwordSource, "interactive-prompt");
  assert.ok(plan.arguments.includes("ON_ERROR_STOP=1"));
  assert.ok(plan.arguments.includes("--single-transaction"));
  assert.equal(plan.arguments.some((value) => /password=/i.test(value)), false);
});

test("every operation is refused without DryRun", () => {
  const arguments_ = testWriteArguments();
  arguments_.splice(arguments_.indexOf("-DryRun"), 1);
  const result = runSafety(arguments_);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /permits DryRun only/i);
});

test("production identity can never be used for a write operation", () => {
  const arguments_ = testWriteArguments();
  arguments_[arguments_.indexOf("db.test.invalid")] = "db.production.invalid";
  arguments_[arguments_.indexOf("test-ref")] = "production-ref";
  const result = runSafety(arguments_);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /test-write requires the exact test identity/i);
});

test("unknown target identity is rejected", () => {
  const arguments_ = testWriteArguments();
  arguments_[arguments_.indexOf("db.test.invalid")] = "db.unknown.invalid";
  const result = runSafety(arguments_);

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /neither the exact production identity nor the exact test identity/i,
  );
});

test("production target permits schema-only dump plan and nothing else", () => {
  const outputFile = `${process.env.TEMP ?? process.env.TMP}\\greencontrol-schema-test.sql`;
  const result = runSafety([
    "-Operation",
    "schema-dump",
    "-TargetKind",
    "production-read",
    "-TargetHost",
    "db.production.invalid",
    "-TargetProjectRef",
    "production-ref",
    ...identities,
    "-OutputFile",
    outputFile,
    "-DryRun",
  ]);

  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout) as {
    tool: string;
    arguments: string[];
    executionAllowed: boolean;
  };

  assert.equal(plan.tool, "pg_dump");
  assert.equal(plan.executionAllowed, false);
  assert.ok(plan.arguments.includes("--schema-only"));
  assert.ok(plan.arguments.includes("public"));
  assert.equal(plan.arguments.includes("--data-only"), false);
  assert.equal(plan.arguments.includes("--role-only"), false);
});

test("production read mode rejects every non-dump operation", () => {
  const result = runSafety([
    "-Operation",
    "apply-forward",
    "-TargetKind",
    "production-read",
    "-TargetHost",
    "db.production.invalid",
    "-TargetProjectRef",
    "production-ref",
    ...identities,
    "-InputFile",
    forwardDraft,
    "-DryRun",
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Only schema-dump is permitted/i);
});

test("SQL input outside the repository is rejected at directory boundary", () => {
  const outsideFile = `${process.env.TEMP ?? process.env.TMP}\\outside.sql`;
  const arguments_ = testWriteArguments();
  arguments_[arguments_.indexOf(forwardDraft)] = outsideFile;
  const result = runSafety(arguments_);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /inside the GreenControl repository/i);
});

test("missing SQL input inside the repository is rejected", () => {
  const missingFile = fileURLToPath(
    new URL("../../supabase/migration-drafts/missing.sql", import.meta.url),
  );
  const arguments_ = testWriteArguments();
  arguments_[arguments_.indexOf(forwardDraft)] = missingFile;
  const result = runSafety(arguments_);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not exist/i);
});

test("tool inspection is read-only and tolerates tools not installed yet", () => {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      toolsScript,
    ],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout) as {
    executionPerformed: boolean;
    tools: Record<string, { available: boolean; versionChecked: boolean }>;
  };

  assert.equal(report.executionPerformed, false);
  assert.deepEqual(Object.keys(report.tools).sort(), ["pg_dump", "psql"]);
  assert.equal(report.tools.pg_dump.versionChecked, false);
  assert.equal(report.tools.psql.versionChecked, false);
});
