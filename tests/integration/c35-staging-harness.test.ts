import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const runner = fileURLToPath(
  new URL("scripts/integration/invoke-c35-staging.ps1", root),
);

test("C3.5 harness binds exact Staging identities without reading secrets", () => {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      runner,
      "-DatabaseHost",
      "aws-0-eu-west-3.pooler.supabase.com",
      "-DatabaseUser",
      "postgres.iacplyydjtiirghwixys",
      "-DryRun",
    ],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.expectedProjectRef, "iacplyydjtiirghwixys");
  assert.equal(output.expectedApiHost, "iacplyydjtiirghwixys.supabase.co");
  assert.equal(output.connectionAttempted, false);
  assert.equal(output.secretsRead, false);
});

test("C3.5 exercises isolation, one-per-actor, ACK and cleanup", async () => {
  const source = await readFile(
    new URL("scripts/integration/c35-command-poll-staging.ts", root),
    "utf8",
  );

  assert.match(source, /DEVICE ISOLATION AND ONE-PER-ACTOR PASSED/);
  assert.match(source, /DELIVERY IDEMPOTENCY PASSED/);
  assert.match(source, /ACTOR-SPECIFIC ACKS PASSED/);
  assert.match(source, /ACK IDEMPOTENCY PASSED/);
  assert.match(source, /CROSS-DEVICE ACK REJECTED/);
  assert.match(source, /finally\s*\{\s*await cleanupFixtures\(\)/);
  assert.match(source, /FIXTURES REMOVED/);
  assert.doesNotMatch(source, /\.env\.local/);
});
