import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const current = new URL("../../firmware/current/", import.meta.url);

async function source(name: string): Promise<string> {
  return readFile(new URL(name, current), "utf8");
}

test("DS18B20 data pin is GPIO21", async () => {
  const temperature = await source("GCTemperatureService.cpp");
  assert.match(
    temperature,
    /constexpr\s+uint8_t\s+TEMPERATURE_SENSOR_PIN\s*=\s*21\s*;/,
  );
});

test("watering uses physical CH5 and zero-based channel 4", async () => {
  const config = await source("GCConfig.example.h");
  const readme = await source("README.md");

  assert.match(config, /#define\s+GC_RELAY_WATERING\s+4\b/);
  assert.match(readme, /CH5/);
  assert.match(readme, /Firmwarewert 4/);
});

test("roof and wall relay channels CH1 through CH4 are blocked", async () => {
  const relayBoard = await source("GCRelayBoard.cpp");
  const config = await source("GCConfig.example.h");

  assert.match(config, /GC_RELAY_ROOF_OPEN\s+0\b/);
  assert.match(config, /GC_RELAY_ROOF_CLOSE\s+1\b/);
  assert.match(config, /GC_RELAY_WALL_OPEN\s+2\b/);
  assert.match(config, /GC_RELAY_WALL_CLOSE\s+3\b/);

  for (const channel of [
    "GC_RELAY_ROOF_OPEN",
    "GC_RELAY_ROOF_CLOSE",
    "GC_RELAY_WALL_OPEN",
    "GC_RELAY_WALL_CLOSE",
  ]) {
    assert.match(relayBoard, new RegExp(`channel\\s*==\\s*${channel}`));
  }

  assert.match(
    relayBoard,
    /channel\s*==\s*GC_RELAY_WALL_CLOSE[\s\S]*?\)\s*\{\s*return false\s*;/,
  );
});

test("window commands cannot start roof or wall movement", async () => {
  const safety = await source("GCSafetyController.cpp");

  const roofMovement =
    safety.match(
      /void\s+GCSafetyController::moveRoof\(bool\)\s*\{([\s\S]*?)\n\}/,
    )?.[1] ?? "";
  const wallMovement =
    safety.match(
      /void\s+GCSafetyController::moveWall\(bool\)\s*\{([\s\S]*?)\n\}/,
    )?.[1] ?? "";

  assert.match(roofMovement, /\bstopRoof\(\)\s*;/);
  assert.match(wallMovement, /\bstopWall\(\)\s*;/);
  assert.doesNotMatch(roofMovement, /r_->set\([^,]+,\s*true\)/);
  assert.doesNotMatch(wallMovement, /r_->set\([^,]+,\s*true\)/);

  const applyCommands =
    safety.match(
      /void\s+GCSafetyController::applyCloudCommands\([^)]*\)\s*\{([\s\S]*?)\n\}/,
    )?.[1] ?? "";

  assert.notEqual(applyCommands, "");
  assert.doesNotMatch(applyCommands, /\bmoveRoof\s*\(/);
  assert.doesNotMatch(applyCommands, /\bmoveWall\s*\(/);
  assert.doesNotMatch(applyCommands, /\bhasRoofTarget\b/);
  assert.doesNotMatch(applyCommands, /\bhasWallTarget\b/);
});
