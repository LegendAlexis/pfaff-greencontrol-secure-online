import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const forwardUrl = new URL(
  "supabase/migration-drafts/20260731_c2_device_commands_DRAFT.sql",
  root,
);
const rollbackUrl = new URL(
  "supabase/migration-drafts/20260731_c2_device_commands_ROLLBACK_DRAFT.sql",
  root,
);
const documentationUrl = new URL(
  "docs/greencontrol-2x/c2-device-command-migration.md",
  root,
);
const validationUrl = new URL(
  "scripts/database/c2-staging-validation.sql",
  root,
);
const runner = fileURLToPath(
  new URL("scripts/database/invoke-c2-staging-validation.ps1", root),
);

async function artifacts() {
  const [forward, rollback, documentation] = await Promise.all([
    readFile(forwardUrl, "utf8"),
    readFile(rollbackUrl, "utf8"),
    readFile(documentationUrl, "utf8"),
  ]);

  return { forward, rollback, documentation };
}

test("C2 artifacts remain review-only and contain no execution command", async () => {
  const { forward, rollback, documentation } = await artifacts();

  assert.match(forward, /^-- DRAFT ONLY - DO NOT RUN AGAINST PRODUCTION\./);
  assert.match(rollback, /^-- DRAFT ONLY - ISOLATED TEST DATABASES ONLY\./);
  assert.match(documentation, /weder gegen Staging noch gegen\s+Produktion/i);
  assert.doesNotMatch(
    `${forward}\n${rollback}\n${documentation}`,
    /\b(psql|supabase\s+db|db\s+push)\b/i,
  );
});

test("C2 creates exactly one additive command table", async () => {
  const { forward } = await artifacts();
  const createdTables = [
    ...forward.matchAll(/\bcreate\s+table\s+([a-z0-9_.]+)/gi),
  ].map((match) => match[1]);

  assert.deepEqual(createdTables, ["public.device_commands"]);
  assert.doesNotMatch(
    forward,
    /\balter\s+table\s+public\.(devices|greenhouses|manual_commands)\b/i,
  );
  assert.doesNotMatch(
    forward,
    /\b(drop\s+(table|column)|truncate|delete\s+from|update\s+public\.|insert\s+into)\b/i,
  );
});

test("C2 supports all three typed core actuators", async () => {
  const { forward } = await artifacts();

  for (const actuator of [
    "watering",
    "roof_window",
    "side_window",
  ]) {
    assert.match(forward, new RegExp(`'${actuator}'`));
  }

  assert.match(forward, /actuator = 'watering' and command = 'set'/i);
  assert.match(
    forward,
    /actuator in \('roof_window', 'side_window'\)[\s\S]*?command = 'move'/i,
  );
  assert.match(forward, /payload->>'state' in \('on', 'off'\)/i);
  assert.match(
    forward,
    /payload->>'action' in \('open', 'stop', 'close'\)/i,
  );
});

test("C2 uses an atomic monotone sequence and enforces device ordering", async () => {
  const { forward, documentation } = await artifacts();

  assert.match(
    forward,
    /sequence\s+bigint\s+generated always as identity/i,
  );
  assert.match(
    forward,
    /unique\s*\(device_id,\s*actuator,\s*sequence\)/i,
  );
  assert.match(documentation, /Firmware[\s\S]*getrennt für `watering`/i);
});

test("C2 preserves device identity and command history on device deletion", async () => {
  const { forward, documentation } = await artifacts();

  assert.match(
    forward,
    /references public\.devices\(id\) on delete restrict/i,
  );
  assert.doesNotMatch(forward, /on delete (cascade|set null)/i);
  assert.match(documentation, /Gerätebeziehung verwendet `ON DELETE RESTRICT`/);
  assert.match(documentation, /`SET NULL` wurde verworfen/);
});

test("C2 stores delivery, acknowledgement and actual state", async () => {
  const { forward } = await artifacts();

  for (const column of [
    "status",
    "created_at",
    "expires_at",
    "delivered_at",
    "acknowledged_at",
    "ack_reason",
    "actual_state",
  ]) {
    assert.match(forward, new RegExp(`\\b${column}\\b`, "i"));
  }

  for (const status of [
    "pending",
    "delivered",
    "applied",
    "already_applied",
    "rejected",
    "expired",
    "superseded",
    "unsupported",
    "failed",
  ]) {
    assert.match(forward, new RegExp(`'${status}'`));
  }
});

test("C2 is deny-by-default for public API roles", async () => {
  const { forward } = await artifacts();

  assert.match(
    forward,
    /alter table public\.device_commands enable row level security/i,
  );
  assert.doesNotMatch(
    forward,
    /create\s+policy[\s\S]*?on\s+public\.device_commands/i,
  );
  assert.match(
    forward,
    /revoke all privileges on table public\.device_commands\s+from public, anon, authenticated/i,
  );
  assert.match(
    forward,
    /revoke all privileges on sequence public\.device_commands_sequence_seq\s+from public, anon, authenticated/i,
  );
  assert.match(
    forward,
    /grant select, insert, update, delete on table public\.device_commands\s+to service_role/i,
  );
});

test("C2 adds only the open-command poll index", async () => {
  const { forward } = await artifacts();
  const indexes = [...forward.matchAll(/\bcreate\s+index\s+(\w+)/gi)].map(
    (match) => match[1],
  );

  assert.deepEqual(indexes, ["device_commands_poll_idx"]);
  assert.match(
    forward,
    /on public\.device_commands \(device_id, sequence\)\s+where status in \('pending', 'delivered'\)/i,
  );
});

test("C2 rollback refuses to delete command history", async () => {
  const { rollback, documentation } = await artifacts();
  const guardPosition = rollback.indexOf("C2 rollback refused");
  const dropPosition = rollback.search(/\bdrop\s+table\b/i);

  assert.ok(guardPosition >= 0);
  assert.ok(dropPosition > guardPosition);
  assert.match(
    rollback,
    /to_regclass\('public\.device_commands'\)[\s\S]*?execute[\s\S]*?select exists \(select 1 from public\.device_commands limit 1\)/i,
  );
  assert.match(documentation, /Forward-Recovery/i);
});

test("C2 contains no tenant, firmware or hardware changes", async () => {
  const { forward, rollback } = await artifacts();
  const sql = `${forward}\n${rollback}`;

  assert.doesNotMatch(sql, /\b(organizations|sites|tenant)\b/i);
  assert.doesNotMatch(sql, /\b(gpio|relay|firmware_version)\b/i);
  assert.doesNotMatch(sql, /\b(manual_commands|watering_schedule)\b/i);
});

test("C2 Staging validation covers apply, positive, negative and rollback", async () => {
  const validation = await readFile(validationUrl, "utf8");

  assert.match(validation, /READ-ONLY PREFLIGHT/i);
  assert.match(validation, /APPLY FORWARD DRAFT/i);
  assert.match(validation, /expected 3 core-actuator commands/i);
  assert.match(
    validation,
    /\\set fixture_greenhouse_id -9223372036854775000/i,
  );
  assert.doesNotMatch(
    validation,
    /returning id as fixture_greenhouse_id/i,
  );
  assert.match(validation, /mismatched watering command accepted/i);
  assert.match(validation, /extra payload field accepted/i);
  assert.match(validation, /nonpositive validity accepted/i);
  assert.match(validation, /device history deletion accepted/i);
  assert.match(validation, /ROLLBACK TEST/i);
  assert.match(validation, /public\.device_commands still exists/i);
  assert.doesNotMatch(validation, /1\s*\/\s*0/);
  assert.match(validation, /BASELINE RESTORED/i);
});

test("C2 Staging runner refuses by default and binds the exact project", () => {
  const baseArguments = [
    "-DatabaseHost",
    "aws-0-eu-west-3.pooler.supabase.com",
    "-DatabaseUser",
    "postgres.iacplyydjtiirghwixys",
  ];
  const run = (arguments_: string[]) =>
    spawnSync(
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

  const refused = run(baseArguments);
  assert.notEqual(refused.status, 0);

  const dryRun = run([...baseArguments, "-DryRun"]);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  const output = JSON.parse(dryRun.stdout);
  assert.equal(output.expectedProjectRef, "iacplyydjtiirghwixys");
  assert.equal(output.connectionAttempted, false);

  for (const [argument, value] of [
    ["-DatabaseHost", "unexpected.pooler.supabase.com"],
    ["-DatabaseUser", "postgres.unexpected"],
  ]) {
    const mismatched = [...baseArguments];
    mismatched[mismatched.indexOf(argument) + 1] = value;
    mismatched.push("-DryRun");
    assert.notEqual(run(mismatched).status, 0);
  }
});
