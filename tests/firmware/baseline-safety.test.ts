import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("legacy firmware is not an active build source", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("firmware/firmware-build-manifest.json", root),
      "utf8",
    ),
  ) as {
    sourceDirectory: string;
    entrySketch: string;
    legacySourceExcluded: string;
  };
  const compileScript = await readFile(
    new URL("scripts/firmware/compile-current.ps1", root),
    "utf8",
  );

  assert.equal(manifest.sourceDirectory, "firmware/current");
  assert.match(manifest.entrySketch, /^firmware\/current\//);
  assert.equal(
    manifest.legacySourceExcluded,
    "waveshare_greenhouse_frost_safe.ino",
  );
  assert.doesNotMatch(compileScript, /waveshare_greenhouse_frost_safe\.ino/);
});

test("GCConfig.h is absent and protected while example remains allowed", async () => {
  const ignore = await readFile(new URL(".gitignore", root), "utf8");

  await assert.rejects(
    access(new URL("firmware/current/GCConfig.h", root)),
  );
  await access(new URL("firmware/current/GCConfig.example.h", root));

  assert.match(ignore, /^\*\*\/GCConfig\.h$/m);
  assert.match(ignore, /^!\*\*\/GCConfig\.example\.h$/m);
});

test("compile harness has no upload, flash, OTA, or network execution", async () => {
  const compileScript = await readFile(
    new URL("scripts/firmware/compile-current.ps1", root),
    "utf8",
  );

  assert.match(compileScript, /\$ArduinoCli\s*=\s*"arduino-cli"/);
  assert.match(compileScript, /&\s+\$tool\.Source\s+compile\b/);
  assert.doesNotMatch(compileScript, /\b(upload|flash|ota)\b/i);
  assert.doesNotMatch(
    compileScript,
    /\b(Invoke-WebRequest|Invoke-RestMethod|curl|wget)\b/i,
  );
});
