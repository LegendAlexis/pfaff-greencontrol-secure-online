import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const forwardUrl = new URL(
  "supabase/migration-drafts/20260729_2a_multi_tenant_foundation_DRAFT.sql",
  root,
);
const rollbackUrl = new URL(
  "supabase/migration-drafts/20260729_2a_multi_tenant_foundation_ROLLBACK_DRAFT.sql",
  root,
);

async function migrationDrafts() {
  const [forward, rollback] = await Promise.all([
    readFile(forwardUrl, "utf8"),
    readFile(rollbackUrl, "utf8"),
  ]);

  return { forward, rollback };
}

test("migration files are unmistakably non-production drafts", async () => {
  const { forward, rollback } = await migrationDrafts();

  assert.match(forward, /^-- DRAFT ONLY - DO NOT RUN AGAINST PRODUCTION\./);
  assert.match(rollback, /^-- DRAFT ONLY - ISOLATED TEST DATABASES ONLY\./);
  assert.match(rollback, /DO NOT RUN AGAINST PRODUCTION/);
});

test("forward draft is additive and contains no data mutation", async () => {
  const { forward } = await migrationDrafts();

  assert.doesNotMatch(
    forward,
    /\b(drop\s+(table|column)|truncate|delete\s+from|update\s+public\.|insert\s+into)\b/i,
  );
  assert.doesNotMatch(forward, /\b(psql|supabase\s+db|db\s+push)\b/i);

  for (const table of [
    "organizations",
    "sites",
    "organization_members",
  ]) {
    assert.match(
      forward,
      new RegExp(`create table if not exists public\\.${table}\\b`, "i"),
    );
  }
});

test("existing greenhouse and device tenant columns start nullable", async () => {
  const { forward } = await migrationDrafts();

  for (const table of ["greenhouses", "devices"]) {
    const alteration =
      forward.match(
        new RegExp(
          `alter table public\\.${table}([\\s\\S]*?);`,
          "i",
        ),
      )?.[1] ?? "";

    assert.notEqual(alteration, "");
    assert.match(alteration, /organization_id\s+uuid\s+null/i);
    assert.match(alteration, /site_id\s+uuid\s+null/i);
    assert.match(alteration, /deployment_stage\s+text\s+null/i);
    assert.match(alteration, /lifecycle_status\s+text\s+null/i);
    assert.doesNotMatch(alteration, /\bnot null\b/i);
  }
});

test("new tenant records have lifecycle, deployment and timestamps", async () => {
  const { forward } = await migrationDrafts();

  assert.match(forward, /deployment_stage[\s\S]*?'pilot'[\s\S]*?'production'/i);
  assert.match(forward, /lifecycle_status[\s\S]*?'active'[\s\S]*?'archived'/i);

  for (const table of [
    "organizations",
    "sites",
    "organization_members",
  ]) {
    const definition =
      forward.match(
        new RegExp(
          `create table if not exists public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`,
          "i",
        ),
      )?.[1] ?? "";

    assert.match(definition, /\bcreated_at\s+timestamptz\b/i);
    assert.match(definition, /\bupdated_at\s+timestamptz\b/i);
  }
});

test("draft contains no committed identities or secrets", async () => {
  const { forward, rollback } = await migrationDrafts();
  const combined = `${forward}\n${rollback}`;

  assert.doesNotMatch(combined, /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
  assert.doesNotMatch(
    combined,
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  );
  assert.doesNotMatch(
    combined,
    /\b(password|device_secret|service_role_key|anon_key)\s*=/i,
  );
});

test("rollback refuses to remove populated tenant structures", async () => {
  const { rollback } = await migrationDrafts();
  const guardPosition = rollback.indexOf("2A rollback refused");
  const firstDropPosition = rollback.search(/\bdrop\s+(policy|function|table)\b/i);

  assert.ok(guardPosition >= 0);
  assert.ok(firstDropPosition > guardPosition);
  assert.match(rollback, /from public\.organization_members/i);
  assert.match(rollback, /from public\.sites/i);
  assert.match(rollback, /from public\.organizations/i);
  assert.match(rollback, /from public\.greenhouses/i);
  assert.match(rollback, /from public\.devices/i);
});

test("package migration test script cannot execute SQL", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("package.json", root), "utf8"),
  ) as { scripts?: Record<string, string> };
  const migrationScript = packageJson.scripts?.["test:migration"] ?? "";

  assert.match(migrationScript, /^node\b/);
  assert.doesNotMatch(
    migrationScript,
    /\b(psql|supabase|db\s+push|migration\s+up)\b/i,
  );
});
