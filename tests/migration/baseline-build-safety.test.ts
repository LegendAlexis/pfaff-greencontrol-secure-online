import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const runner = fileURLToPath(
  new URL("scripts/database/invoke-baseline-build.ps1", root),
);
const sourceMapUrl = new URL("supabase/README.md", root);

const baseArguments = [
  "-TargetHost",
  "aws-0-isolated.pooler.supabase.com",
  "-TargetProjectRef",
  "isolated-project",
  "-DatabaseUser",
  "postgres.isolated-project",
  "-ProductionHost",
  "aws-1-production.pooler.supabase.com",
  "-ProductionProjectRef",
  "production-project",
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

test("baseline runner defaults to refusal", () => {
  const result = run(baseArguments);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires DryRun or ExecuteOnIsolatedTarget/i);
});

test("baseline dry-run binds one isolated project identity", () => {
  const result = run([...baseArguments, "-DryRun"]);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);

  assert.equal(output.mode, "dry-run");
  assert.equal(output.targetProjectRef, "isolated-project");
  assert.equal(output.databaseUser, "postgres.isolated-project");
  assert.equal(output.productionContacted, false);
  assert.equal(output.executable, false);
  assert.deepEqual(
    output.files.map((file: string) => file.replaceAll("\\", "/").split("/").at(-1)),
    ["001_public_schema.sql", "002_p0_security_target.sql"],
  );
});

test("baseline runner rejects every production identity match", () => {
  for (const [name, value] of [
    ["-TargetHost", "aws-1-production.pooler.supabase.com"],
    ["-TargetProjectRef", "production-project"],
    ["-DatabaseUser", "postgres.production-project"],
  ]) {
    const arguments_ = [...baseArguments];
    arguments_[arguments_.indexOf(name) + 1] = value;
    arguments_.push("-DryRun");

    const result = run(arguments_);

    assert.notEqual(result.status, 0);
  }
});

test("historical SQL is excluded from the executable build path", async () => {
  const sourceMap = await readFile(sourceMapUrl, "utf8");

  assert.match(sourceMap, /baseline\/001_public_schema\.sql/);
  assert.match(sourceMap, /baseline\/002_p0_security_target\.sql/);
  assert.match(sourceMap, /Historical references/i);
  assert.match(sourceMap, /must not be replayed/i);
});
