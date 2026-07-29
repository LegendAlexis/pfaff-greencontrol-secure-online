import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const LEGACY_FILE = "waveshare_greenhouse_frost_safe.ino";

test("project scripts never build or flash the legacy firmware", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { scripts?: Record<string, string> };
  const scripts = Object.values(packageJson.scripts ?? {}).join("\n");

  assert.equal(scripts.includes(LEGACY_FILE), false);
  assert.equal(/\b(arduino-cli|platformio|pio)\b/i.test(scripts), false);
});

test("legacy policy explicitly marks the old firmware as DO NOT FLASH", async () => {
  const policy = await readFile(
    new URL(
      "../../docs/greencontrol-2x/legacy-firmware-policy.md",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(policy, /waveshare_greenhouse_frost_safe\.ino/);
  assert.match(policy, /DO NOT FLASH/);
});
