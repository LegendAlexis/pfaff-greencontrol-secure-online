import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateWateringDecision,
  getCurrentMinutesInZurich,
  isScheduleCurrentlyActive,
  parseStartTime,
} from "../../lib/domain/watering.ts";

test("parses valid schedule times and rejects invalid values", () => {
  assert.equal(parseStartTime("00:00"), 0);
  assert.equal(parseStartTime("23:59"), 23 * 60 + 59);
  assert.equal(parseStartTime("24:00"), null);
  assert.equal(parseStartTime("12:60"), null);
  assert.equal(parseStartTime("invalid"), null);
});

test("evaluates a same-day schedule with an exclusive end", () => {
  assert.equal(isScheduleCurrentlyActive("06:00", 10, 6 * 60), true);
  assert.equal(isScheduleCurrentlyActive("06:00", 10, 6 * 60 + 9), true);
  assert.equal(isScheduleCurrentlyActive("06:00", 10, 6 * 60 + 10), false);
});

test("evaluates schedules across midnight", () => {
  assert.equal(isScheduleCurrentlyActive("23:55", 15, 23 * 60 + 59), true);
  assert.equal(isScheduleCurrentlyActive("23:55", 15, 5), true);
  assert.equal(isScheduleCurrentlyActive("23:55", 15, 10), false);
  assert.equal(isScheduleCurrentlyActive("23:55", 15, 12 * 60), false);
});

test("treats schedules of at least 24 hours as active", () => {
  assert.equal(isScheduleCurrentlyActive("12:00", 24 * 60, 0), true);
  assert.equal(isScheduleCurrentlyActive("12:00", 25 * 60, 23 * 60), true);
});

test("rejects invalid schedule durations", () => {
  assert.equal(isScheduleCurrentlyActive("06:00", 0, 6 * 60), false);
  assert.equal(isScheduleCurrentlyActive("06:00", -1, 6 * 60), false);
  assert.equal(isScheduleCurrentlyActive("06:00", Number.NaN, 6 * 60), false);
});

test("uses Europe/Zurich in winter and summer", () => {
  assert.equal(
    getCurrentMinutesInZurich(new Date("2026-01-15T05:30:00.000Z")),
    6 * 60 + 30,
  );
  assert.equal(
    getCurrentMinutesInZurich(new Date("2026-07-15T04:30:00.000Z")),
    6 * 60 + 30,
  );
});

test("manual watering follows the stored target", () => {
  const on = evaluateWateringDecision({
    ...automaticInput(),
    wateringManualOverride: true,
    wateringTarget: true,
  });
  const off = evaluateWateringDecision({
    ...automaticInput(),
    wateringManualOverride: true,
    wateringTarget: false,
  });

  assert.deepEqual(on, {
    mode: "manual",
    scheduleActive: false,
    frostProtectionActive: false,
    effectiveTarget: true,
  });
  assert.equal(off.effectiveTarget, false);
});

test("automatic watering follows an active schedule", () => {
  const decision = evaluateWateringDecision(automaticInput());

  assert.equal(decision.mode, "schedule");
  assert.equal(decision.scheduleActive, true);
  assert.equal(decision.effectiveTarget, true);
});

test("frost status overrides manual watering", () => {
  const decision = evaluateWateringDecision({
    ...automaticInput(),
    wateringManualOverride: true,
    wateringTarget: true,
    status: "frost_protection",
  });

  assert.equal(decision.frostProtectionActive, true);
  assert.equal(decision.effectiveTarget, false);
});

test("temperature at or below zero overrides scheduled watering", () => {
  for (const temperature of [0, -0.1]) {
    const decision = evaluateWateringDecision({
      ...automaticInput(),
      temperature,
    });
    assert.equal(decision.frostProtectionActive, true);
    assert.equal(decision.effectiveTarget, false);
  }
});

function automaticInput() {
  return {
    wateringManualOverride: false,
    wateringTarget: false,
    schedules: [{ start_time: "12:00", duration_minutes: 10 }],
    now: new Date("2026-07-15T10:05:00.000Z"),
    status: "online",
    temperature: 20,
  };
}
