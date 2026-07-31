import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const current = new URL("../../firmware/current/", import.meta.url);

async function source(name: string) {
  return readFile(new URL(name, current), "utf8");
}

test("C4.3 separates all three actuator controllers", async () => {
  for (const controller of [
    "GCWateringCommandController",
    "GCRoofWindowCommandController",
    "GCSideWindowCommandController",
  ]) {
    const header = await source(`${controller}.h`);
    const implementation = await source(`${controller}.cpp`);
    assert.match(header, new RegExp(`class ${controller}`));
    assert.match(implementation, new RegExp(`${controller}::process`));
  }
});

test("shared guard checks validity, pending ACK and monotone sequences", async () => {
  const guard = await source("GCActuatorCommandGuard.cpp");

  assert.match(guard, /structurallyValid\(command, expectedActuator\)/);
  assert.match(guard, /loadPendingAcknowledgement/);
  assert.match(guard, /pending\.commandId == command\.id/);
  assert.match(guard, /command\.sequence < lastApplied/);
  assert.match(guard, /command\.sequence == lastApplied/);
  assert.match(guard, /ReusePendingAcknowledgement/);
  assert.match(guard, /Superseded/);
});

test("watering is the only controller allowed to energize an output", async () => {
  const watering = await source("GCWateringCommandController.cpp");
  const roof = await source("GCRoofWindowCommandController.cpp");
  const side = await source("GCSideWindowCommandController.cpp");

  assert.match(watering, /set\(GC_RELAY_WATERING, targetOn\)/);
  assert.match(watering, /GC_WATERING_FROST_LOCK_C/);
  assert.match(watering, /GC_TEMPERATURE_MAX_AGE_MS/);
  assert.match(watering, /temperatureMeasuredAtMs_ != 0/);
  assert.match(watering, /targetOn && \(!temperatureIsCurrent \|\| isnan/);
  assert.match(watering, /GC_ENABLE_OUTPUTS/);
  assert.match(watering, /targetOn && !GC_ENABLE_OUTPUTS/);
  assert.doesNotMatch(watering, /GC_RELAY_(ROOF|WALL)_/);
  assert.doesNotMatch(`${roof}\n${side}`, /set\([^,]+,\s*true\)/);
});

test("disabled window commands force both directions off", async () => {
  const roof = await source("GCRoofWindowCommandController.cpp");
  const side = await source("GCSideWindowCommandController.cpp");

  assert.match(roof, /set\(GC_RELAY_ROOF_OPEN, false\)/);
  assert.match(roof, /set\(GC_RELAY_ROOF_CLOSE, false\)/);
  assert.match(side, /set\(GC_RELAY_WALL_OPEN, false\)/);
  assert.match(side, /set\(GC_RELAY_WALL_CLOSE, false\)/);
  assert.match(roof, /"rejected", "component_disabled"/);
  assert.match(side, /"rejected", "component_disabled"/);
});

test("sequence is persisted before the CH5 transition", async () => {
  const watering = await source("GCWateringCommandController.cpp");
  const sequenceWrite = watering.indexOf("saveSequence(");
  const relayWrite = watering.indexOf("set(GC_RELAY_WATERING, targetOn)");

  assert.ok(sequenceWrite >= 0);
  assert.ok(relayWrite > sequenceWrite);
  assert.match(watering, /alreadyAtTarget/);
});

test("sketch does not couple directly to individual actuator controllers", async () => {
  const sketch = await source(
    "Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off.ino",
  );

  assert.doesNotMatch(sketch, /CommandController/);
  assert.match(sketch, /cloudClient\.sendHeartbeat/);
});
