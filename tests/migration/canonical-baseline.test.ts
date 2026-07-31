import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const schemaUrl = new URL("supabase/baseline/001_public_schema.sql", root);
const securityUrl = new URL(
  "supabase/baseline/002_p0_security_target.sql",
  root,
);

async function baseline() {
  const [schema, security] = await Promise.all([
    readFile(schemaUrl, "utf8"),
    readFile(securityUrl, "utf8"),
  ]);

  return { schema, security };
}

function occurrences(text: string, pattern: RegExp) {
  return [...text.matchAll(pattern)].length;
}

test("canonical structural baseline matches the verified public inventory", async () => {
  const { schema } = await baseline();

  assert.equal(
    occurrences(schema, /^CREATE TABLE public\./gim),
    13,
  );
  assert.equal(
    occurrences(schema, /SEQUENCE NAME public\.[a-z0-9_]+/gim),
    8,
  );
  assert.equal(
    occurrences(schema, /^CREATE FUNCTION public\./gim),
    5,
  );
  assert.equal(
    occurrences(schema, /^CREATE TRIGGER /gim),
    2,
  );
  assert.equal(
    occurrences(schema, /^CREATE POLICY /gim),
    26,
  );
});

test("canonical baseline contains only synthetic bootstrap identities", async () => {
  const { schema } = await baseline();
  const emailLiterals =
    schema.match(
      /'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'/g,
    ) ?? [];

  assert.deepEqual(emailLiterals.sort(), [
    "'bootstrap-admin@example.invalid'",
    "'bootstrap-owner@example.invalid'",
  ]);
});

test("P0 overlay preserves the measured minimal security target", async () => {
  const { security } = await baseline();
  const executableSql = security.replace(/^\s*--.*$/gm, "");

  assert.match(
    executableSql,
    /alter table public\.manual_commands enable row level security/i,
  );
  assert.match(
    executableSql,
    /revoke update on table public\.profiles\s+from public, anon, authenticated/i,
  );
  assert.match(
    executableSql,
    /revoke all privileges on table public\.manual_commands\s+from public, anon, authenticated/i,
  );
  assert.doesNotMatch(
    executableSql,
    /\b(organizations|sites|tenant)\b/i,
  );
  assert.doesNotMatch(
    executableSql,
    /^\s*(insert|update|delete|truncate)\b/im,
  );
});
