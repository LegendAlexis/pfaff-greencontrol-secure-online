import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const draftUrl = new URL(
  "supabase/migration-drafts/20260730_security_gate_hardening_DRAFT.sql",
  root,
);

async function draft() {
  return readFile(draftUrl, "utf8");
}

test("security gate remains an identity-gated reference draft", async () => {
  const sql = await draft();

  assert.match(
    sql,
    /^-- REFERENCE DRAFT - DO NOT RUN WITHOUT AN EXPLICIT IDENTITY GATE\./,
  );
  assert.doesNotMatch(
    sql,
    /^\s*(insert|update|delete|truncate)\b/im,
  );
  assert.doesNotMatch(sql, /\b(organization|site_id|tenant)\b/i);
});

test("authenticated users cannot update privileged profile columns", async () => {
  const sql = await draft();

  assert.match(
    sql,
    /revoke update on table public\.profiles from public, anon, authenticated/i,
  );
  assert.doesNotMatch(
    sql,
    /\bgrant\s+update\b/i,
  );
});

test("manual commands is deny-by-default for public API roles", async () => {
  const sql = await draft();

  assert.match(
    sql,
    /alter table public\.manual_commands enable row level security/i,
  );
  assert.match(
    sql,
    /revoke all privileges on table public\.manual_commands\s+from public, anon, authenticated/i,
  );
  assert.match(
    sql,
    /revoke all privileges on sequence public\.manual_commands_id_seq\s+from public, anon, authenticated/i,
  );
  assert.doesNotMatch(
    sql,
    /create policy[\s\S]*?on public\.manual_commands/i,
  );
});
