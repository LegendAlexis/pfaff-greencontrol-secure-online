import assert from "node:assert/strict";
import test from "node:test";

import {
  formatTemperature,
  getDeviceState,
  isRecentHeartbeat,
} from "../../lib/presentation/greenhouse-status.ts";

test("formats valid temperature values with degrees Celsius", () => {
  assert.equal(formatTemperature(18.25), "18.3 °C");
  assert.equal(formatTemperature("0"), "0.0 °C");
});

test("formats missing and invalid temperature values with a unit", () => {
  assert.equal(formatTemperature(null), "— °C");
  assert.equal(formatTemperature(undefined), "— °C");
  assert.equal(formatTemperature("invalid"), "— °C");
});

test("distinguishes current and offline heartbeats deterministically", () => {
  const now = Date.parse("2026-07-29T10:05:00.000Z");

  assert.equal(
    isRecentHeartbeat("2026-07-29T10:04:00.000Z", 90_000, now),
    true,
  );
  assert.equal(
    isRecentHeartbeat("2026-07-29T10:03:00.000Z", 90_000, now),
    false,
  );
  assert.equal(getDeviceState(null, now).online, false);
  assert.equal(getDeviceState("invalid", now).label, "Ungültiger Status");
});
