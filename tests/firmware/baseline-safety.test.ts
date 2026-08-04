import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const sketchName = "Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off";
const sketchDirectory = `firmware/current/${sketchName}`;
const execFileAsync = promisify(execFile);

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

  assert.equal(manifest.sourceDirectory, sketchDirectory);
  assert.equal(
    manifest.entrySketch,
    `${sketchDirectory}/${sketchName}.ino`,
  );
  assert.equal(
    manifest.legacySourceExcluded,
    "waveshare_greenhouse_frost_safe.ino",
  );
  assert.doesNotMatch(compileScript, /waveshare_greenhouse_frost_safe\.ino/);
});

test("GCConfig.h is untracked and protected while example remains versioned", async () => {
  const ignore = await readFile(new URL(".gitignore", root), "utf8");

  await access(new URL(`${sketchDirectory}/GCConfig.example.h`, root));
  await assert.rejects(
    execFileAsync(
      "git",
      ["ls-files", "--error-unmatch", `${sketchDirectory}/GCConfig.h`],
      { cwd: fileURLToPath(root) },
    ),
  );

  assert.match(ignore, /^\*\*\/GCConfig\.h$/m);
  assert.match(ignore, /^!\*\*\/GCConfig\.example\.h$/m);
});

test("Arduino IDE and CLI share one canonical sketch directory", async () => {
  const sketchFiles = await readdir(new URL(`${sketchDirectory}/`, root));
  const currentEntries = await readdir(new URL("firmware/current/", root), {
    withFileTypes: true,
  });

  assert.ok(sketchFiles.includes(`${sketchName}.ino`));
  assert.ok(sketchFiles.includes("GCConfig.example.h"));
  assert.ok(sketchFiles.some((name) => name.endsWith(".cpp")));
  assert.ok(sketchFiles.some((name) => name.endsWith(".h")));
  assert.equal(
    currentEntries.filter(
      (entry) =>
        entry.isFile() &&
        [".ino", ".cpp", ".h"].some((extension) =>
          entry.name.endsWith(extension),
        ),
    ).length,
    0,
  );
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
