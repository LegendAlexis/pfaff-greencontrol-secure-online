import assert from "node:assert/strict";
import test from "node:test";

import {
  initialWindowSafetyState,
  isValidWindowSafetyConfiguration,
  validateWindowSafetyState,
  type WindowSafetyConfiguration,
  type WindowSafetyState,
} from "../../lib/domain/window-safety.ts";

const roofConfiguration: WindowSafetyConfiguration = {
  enabled: false,
  policy: "roof",
  directionChangeDelayMs: 1_000,
  maximumOpeningTimeMs: 120_000,
  maximumClosingTimeMs: 120_000,
  limitSensorsRequired: true,
};

test("starts disabled windows safely with an unknown position", () => {
  assert.deepEqual(initialWindowSafetyState({ enabled: false }), {
    componentStatus: "disabled",
    movement: "stopped",
    position: "unknown",
    pendingDirection: null,
    faultCode: null,
    openLimit: null,
    closedLimit: null,
    motionStartedAtMs: null,
    interlockUntilMs: null,
    lastSequence: 0,
  });
});

test("derives only sensor-confirmed roof end positions after restart", () => {
  assert.equal(
    initialWindowSafetyState({
      enabled: true,
      openLimit: true,
      closedLimit: false,
    }).position,
    "open",
  );
  assert.equal(
    initialWindowSafetyState({
      enabled: true,
      openLimit: false,
      closedLimit: true,
    }).position,
    "closed",
  );
  assert.equal(
    initialWindowSafetyState({
      enabled: true,
      openLimit: false,
      closedLimit: false,
    }).position,
    "unknown",
  );
});

test("restores a persisted fault without resuming movement", () => {
  const state = initialWindowSafetyState({
    enabled: true,
    persistedFault: "maximum_runtime_exceeded",
    lastSequence: 17,
  });

  assert.equal(state.componentStatus, "fault_latched");
  assert.equal(state.movement, "stopped");
  assert.equal(state.faultCode, "maximum_runtime_exceeded");
  assert.equal(state.lastSequence, 17);
  assert.deepEqual(validateWindowSafetyState(state), []);
});

test("keeps component status, movement and position orthogonal", () => {
  const invalid = {
    ...initialWindowSafetyState({ enabled: false }),
    movement: "opening",
    position: "closed",
    motionStartedAtMs: 100,
  } satisfies WindowSafetyState;

  assert.deepEqual(validateWindowSafetyState(invalid), [
    "inactive_component_moving",
  ]);
});

test("rejects impossible timer, fault and limit combinations", () => {
  const invalid = {
    ...initialWindowSafetyState({ enabled: true }),
    pendingDirection: "open",
    faultCode: "relay_write_failed",
    openLimit: true,
    closedLimit: true,
  } satisfies WindowSafetyState;

  assert.deepEqual(validateWindowSafetyState(invalid), [
    "pending_direction_without_interlock",
    "fault_code_without_fault_status",
    "conflicting_limits",
  ]);
});

test("requires bounded positive timing and roof limit sensors", () => {
  assert.equal(isValidWindowSafetyConfiguration(roofConfiguration), true);
  assert.equal(
    isValidWindowSafetyConfiguration({
      ...roofConfiguration,
      limitSensorsRequired: false,
    }),
    false,
  );
  assert.equal(
    isValidWindowSafetyConfiguration({
      ...roofConfiguration,
      maximumClosingTimeMs: 0,
    }),
    false,
  );
  assert.equal(
    isValidWindowSafetyConfiguration({
      ...roofConfiguration,
      directionChangeDelayMs: -1,
    }),
    false,
  );
});

test("permits a time-based side policy without limit sensors", () => {
  assert.equal(
    isValidWindowSafetyConfiguration({
      ...roofConfiguration,
      policy: "side",
      limitSensorsRequired: false,
    }),
    true,
  );
});
