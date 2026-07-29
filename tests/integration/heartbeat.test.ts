import assert from "node:assert/strict";
import test from "node:test";

import {
  createHeartbeatPersistence,
  createHeartbeatResponse,
  normalizeHeartbeat,
} from "../../lib/domain/heartbeat.ts";

test("normalizes a valid device heartbeat without external services", () => {
  const heartbeat = normalizeHeartbeat({
    temperature: 18.25,
    status: "online",
    firmware_version: "1.3.1",
    roof_window_open: false,
    wall_window_open: false,
    watering_on: true,
  });

  assert.deepEqual(heartbeat, {
    temperature: 18.25,
    status: "online",
    firmwareVersion: "1.3.1",
    roofWindowOpen: false,
    wallWindowOpen: false,
    wateringOn: true,
  });
});

test("rejects invalid temperatures and limits status fields", () => {
  assert.equal(normalizeHeartbeat({ temperature: -50 }).temperature, null);
  assert.equal(normalizeHeartbeat({ temperature: 80 }).temperature, null);
  assert.equal(normalizeHeartbeat({ temperature: "20" }).temperature, null);

  const normalized = normalizeHeartbeat({
    status: "x".repeat(80),
    firmware_version: "v".repeat(80),
  });
  assert.equal(normalized.status.length, 40);
  assert.equal(normalized.firmwareVersion?.length, 40);
});

test("persists the actual watering state reported by the device", () => {
  const heartbeat = normalizeHeartbeat({
    temperature: 19,
    status: "online",
    firmware_version: "1.3.1",
    watering_on: true,
  });
  const persistence = createHeartbeatPersistence(
    heartbeat,
    7,
    "2026-07-29T10:00:00.000Z",
  );

  assert.equal(persistence.greenhouseUpdate.watering_on, true);
  assert.equal(persistence.sensorReading.watering_on, true);
  assert.equal(persistence.sensorReading.greenhouse_id, 7);
  assert.equal(persistence.deviceUpdate.firmware_version, "1.3.1");
});

test("does not overwrite actual watering state when device omits it", () => {
  const heartbeat = normalizeHeartbeat({ temperature: 19 });
  const persistence = createHeartbeatPersistence(
    heartbeat,
    7,
    "2026-07-29T10:00:00.000Z",
  );

  assert.equal("watering_on" in persistence.greenhouseUpdate, false);
  assert.equal(persistence.sensorReading.watering_on, null);
});

test("integrates midnight schedule, heartbeat and command response", () => {
  const now = new Date("2026-07-29T22:05:00.000Z");
  const heartbeat = normalizeHeartbeat({
    temperature: 12,
    status: "online",
    watering_on: false,
  });
  const response = createHeartbeatResponse({
    greenhouseId: 7,
    greenhouse: automaticGreenhouse(),
    heartbeat,
    schedules: [{ start_time: "23:55", duration_minutes: 15 }],
    now,
  });

  assert.equal(response.watering.mode, "schedule");
  assert.equal(response.watering.schedule_active, true);
  assert.equal(response.commands.watering_target, true);
});

test("integrates frost protection ahead of manual target", () => {
  const now = new Date("2026-07-29T10:00:00.000Z");
  const heartbeat = normalizeHeartbeat({
    temperature: 0,
    status: "online",
    watering_on: true,
  });
  const response = createHeartbeatResponse({
    greenhouseId: 7,
    greenhouse: {
      ...automaticGreenhouse(),
      watering_manual_override: true,
      watering_target: true,
    },
    heartbeat,
    schedules: [],
    now,
  });

  assert.equal(response.watering.frost_protection, true);
  assert.equal(response.commands.watering_target, false);
  assert.equal(heartbeat.wateringOn, true);
});

function automaticGreenhouse() {
  return {
    auto_mode: true,
    roof_window_target: false,
    wall_window_target: false,
    watering_target: false,
    roof_manual_override: false,
    wall_manual_override: false,
    watering_manual_override: false,
  };
}
