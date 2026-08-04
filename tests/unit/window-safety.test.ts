import assert from "node:assert/strict";
import test from "node:test";

import {
  initialWindowSafetyState,
  isValidWindowSafetyConfiguration,
  planWindowCommand,
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

test("plans output confirmation before acknowledging a movement as applied", () => {
  const state = initialWindowSafetyState({
    enabled: true,
    openLimit: false,
    closedLimit: true,
  });
  const decision = planWindowCommand({
    state,
    command: { id: "roof-open-1", operation: "open", sequence: 1 },
    configuration: { ...roofConfiguration, enabled: true },
    nowMs: 1_000,
  });

  assert.equal(decision.kind, "requires_output_confirmation");
  assert.equal(decision.action, "drive_open");
  assert.equal(decision.onConfirmed.acknowledgement.status, "applied");
  assert.equal(decision.onConfirmed.state.movement, "opening");
  assert.equal(decision.onFailure.acknowledgement.status, "failed");
  assert.equal(decision.onFailure.state.componentStatus, "fault_latched");
});

test("preempts enabled, fault and sequence checks for every valid stop", () => {
  const scenarios = [
    {
      state: initialWindowSafetyState({ enabled: false, lastSequence: 5 }),
      sequence: 6,
      status: "applied",
    },
    {
      state: initialWindowSafetyState({
        enabled: true,
        persistedFault: "maximum_runtime_exceeded",
        lastSequence: 5,
      }),
      sequence: 5,
      status: "already_applied",
    },
    {
      state: {
        ...initialWindowSafetyState({ enabled: true, lastSequence: 5 }),
        componentStatus: "emergency_stopped" as const,
        faultCode: "emergency_stop" as const,
      },
      sequence: 4,
      status: "superseded",
    },
  ];

  for (const scenario of scenarios) {
    const decision = planWindowCommand({
      state: scenario.state,
      command: {
        id: `stop-${scenario.sequence}`,
        operation: "stop",
        sequence: scenario.sequence,
      },
      configuration: roofConfiguration,
      nowMs: 2_000,
    });

    assert.equal(decision.kind, "requires_output_confirmation");
    assert.equal(decision.action, "all_off");
    assert.equal(
      decision.onConfirmed.acknowledgement.status,
      scenario.status,
    );
    assert.equal(decision.onConfirmed.state.movement, "stopped");
  }
});

test("reports a failed stop when all-off cannot be confirmed", () => {
  const state = {
    ...initialWindowSafetyState({ enabled: true }),
    movement: "opening" as const,
    position: "partially_open" as const,
    motionStartedAtMs: 100,
  };
  const decision = planWindowCommand({
    state,
    command: { id: "roof-stop-2", operation: "stop", sequence: 2 },
    configuration: { ...roofConfiguration, enabled: true },
    nowMs: 1_000,
  });

  assert.equal(decision.kind, "requires_output_confirmation");
  assert.equal(decision.onFailure.acknowledgement.status, "failed");
  assert.equal(
    decision.onFailure.acknowledgement.reason,
    "relay_write_failed",
  );
  assert.equal(decision.onFailure.state.componentStatus, "fault_latched");
});

test("rejects normal movement for disabled, faulted and emergency windows", () => {
  const scenarios = [
    {
      state: initialWindowSafetyState({ enabled: false }),
      reason: "component_disabled",
    },
    {
      state: initialWindowSafetyState({
        enabled: true,
        persistedFault: "maximum_runtime_exceeded",
      }),
      reason: "fault_latched",
    },
    {
      state: {
        ...initialWindowSafetyState({ enabled: true }),
        componentStatus: "emergency_stopped" as const,
        faultCode: "emergency_stop" as const,
      },
      reason: "emergency_stop",
    },
  ];

  for (const scenario of scenarios) {
    const decision = planWindowCommand({
      state: scenario.state,
      command: { id: "open-1", operation: "open", sequence: 1 },
      configuration: {
        ...roofConfiguration,
        enabled: scenario.state.componentStatus !== "disabled",
      },
      nowMs: 1_000,
    });

    assert.equal(decision.kind, "immediate");
    assert.equal(decision.actions.length, 0);
    assert.equal(decision.acknowledgement.status, "rejected");
    assert.equal(decision.acknowledgement.reason, scenario.reason);
  }
});

test("uses break-before-make planning for a direction reversal", () => {
  const closing = {
    ...initialWindowSafetyState({
      enabled: true,
      openLimit: false,
      closedLimit: false,
      lastSequence: 4,
    }),
    movement: "closing" as const,
    position: "partially_open" as const,
    motionStartedAtMs: 500,
  };
  const decision = planWindowCommand({
    state: closing,
    command: { id: "reverse-5", operation: "open", sequence: 5 },
    configuration: { ...roofConfiguration, enabled: true },
    nowMs: 1_000,
  });

  assert.equal(decision.kind, "requires_output_confirmation");
  assert.equal(decision.action, "all_off");
  assert.equal(decision.onConfirmed.state.movement, "stopped");
  assert.equal(decision.onConfirmed.state.pendingDirection, "open");
  assert.equal(decision.onConfirmed.state.interlockUntilMs, 2_000);
});

test("does not restart a running direction for a newer equivalent command", () => {
  const opening = {
    ...initialWindowSafetyState({
      enabled: true,
      openLimit: false,
      closedLimit: false,
      lastSequence: 3,
    }),
    movement: "opening" as const,
    position: "partially_open" as const,
    motionStartedAtMs: 500,
  };
  const decision = planWindowCommand({
    state: opening,
    command: { id: "open-4", operation: "open", sequence: 4 },
    configuration: { ...roofConfiguration, enabled: true },
    nowMs: 1_000,
  });

  assert.equal(decision.kind, "immediate");
  assert.equal(decision.state.motionStartedAtMs, 500);
  assert.equal(decision.state.lastSequence, 4);
  assert.equal(decision.acknowledgement.status, "applied");
});

test("never infers a physical position from an unconfirmed target", () => {
  const state = initialWindowSafetyState({
    enabled: true,
    openLimit: false,
    closedLimit: false,
  });
  const decision = planWindowCommand({
    state,
    command: { id: "side-open-1", operation: "open", sequence: 1 },
    configuration: {
      ...roofConfiguration,
      enabled: true,
      policy: "side",
      limitSensorsRequired: false,
    },
    nowMs: 1_000,
  });

  assert.equal(decision.kind, "requires_output_confirmation");
  assert.equal(decision.onConfirmed.state.position, "unknown");
});
