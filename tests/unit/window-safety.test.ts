import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  initialWindowSafetyState,
  isValidWindowSafetyConfiguration,
  planWindowCommand,
  planWindowSafetyEvent,
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

test("keeps W1 independent from transport, persistence and hardware", async () => {
  const source = await readFile(
    new URL("../../lib/domain/window-safety.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /createAdminClient|supabase|fetch\s*\(/i);
  assert.doesNotMatch(source, /digitalWrite|pinMode|GCRelayBoard|Arduino\.h/);
  assert.doesNotMatch(source, /app\/api|device_commands|GCConfig/);
});

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

test("latches contradictory end positions during initialization", () => {
  const state = initialWindowSafetyState({
    enabled: true,
    openLimit: true,
    closedLimit: true,
  });

  assert.equal(state.componentStatus, "fault_latched");
  assert.equal(state.faultCode, "conflicting_limits");
  assert.equal(state.movement, "stopped");
  assert.equal(state.position, "unknown");
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

test("requires confirmed all-off when a moving window is already at target", () => {
  const inconsistent = {
    ...initialWindowSafetyState({
      enabled: true,
      openLimit: true,
      closedLimit: false,
    }),
    movement: "opening" as const,
    motionStartedAtMs: 500,
  };
  const decision = planWindowCommand({
    state: inconsistent,
    command: { id: "open-at-limit", operation: "open", sequence: 1 },
    configuration: { ...roofConfiguration, enabled: true },
    nowMs: 1_000,
  });

  assert.equal(decision.kind, "requires_output_confirmation");
  assert.equal(decision.action, "all_off");
  assert.equal(decision.onConfirmed.state.position, "open");
  assert.equal(decision.onConfirmed.state.movement, "stopped");
});

test("fails closed when a moving window has invalid safety configuration", () => {
  const moving = {
    ...initialWindowSafetyState({ enabled: true }),
    movement: "opening" as const,
    motionStartedAtMs: 500,
  };
  const decision = planWindowCommand({
    state: moving,
    command: { id: "open-invalid-config", operation: "open", sequence: 1 },
    configuration: {
      ...roofConfiguration,
      enabled: true,
      maximumOpeningTimeMs: 0,
    },
    nowMs: 1_000,
  });

  assert.equal(decision.kind, "requires_output_confirmation");
  assert.equal(decision.action, "all_off");
  assert.equal(decision.onConfirmed.state.componentStatus, "fault_latched");
  assert.equal(
    decision.onConfirmed.state.faultCode,
    "configuration_invalid",
  );
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

test("stops at the expected roof limit and confirms the end position", () => {
  const opening = {
    ...initialWindowSafetyState({
      enabled: true,
      openLimit: false,
      closedLimit: false,
    }),
    movement: "opening" as const,
    position: "partially_open" as const,
    motionStartedAtMs: 100,
  };
  const transition = planWindowSafetyEvent({
    state: opening,
    event: {
      type: "limits_changed",
      openLimit: true,
      closedLimit: false,
    },
    configuration: { ...roofConfiguration, enabled: true },
  });

  assert.equal(transition.kind, "requires_output_confirmation");
  assert.equal(transition.action, "all_off");
  assert.equal(transition.onConfirmed.movement, "stopped");
  assert.equal(transition.onConfirmed.position, "open");
  assert.equal(transition.onConfirmed.componentStatus, "ready");
});

test("latches conflicting and newly unexpected limit signals", () => {
  const closing = {
    ...initialWindowSafetyState({
      enabled: true,
      openLimit: false,
      closedLimit: false,
    }),
    movement: "closing" as const,
    position: "partially_open" as const,
    motionStartedAtMs: 100,
  };
  const scenarios = [
    {
      event: {
        type: "limits_changed" as const,
        openLimit: true,
        closedLimit: true,
      },
      fault: "conflicting_limits",
    },
    {
      event: {
        type: "limits_changed" as const,
        openLimit: true,
        closedLimit: false,
      },
      fault: "unexpected_limit",
    },
  ];

  for (const scenario of scenarios) {
    const transition = planWindowSafetyEvent({
      state: closing,
      event: scenario.event,
      configuration: { ...roofConfiguration, enabled: true },
    });
    assert.equal(transition.kind, "requires_output_confirmation");
    assert.equal(transition.action, "all_off");
    assert.equal(transition.onConfirmed.componentStatus, "fault_latched");
    assert.equal(transition.onConfirmed.faultCode, scenario.fault);
  }
});

test("allows movement away from an already active origin limit", () => {
  const opening = {
    ...initialWindowSafetyState({
      enabled: true,
      openLimit: false,
      closedLimit: true,
    }),
    movement: "opening" as const,
    position: "partially_open" as const,
    motionStartedAtMs: 100,
  };
  const transition = planWindowSafetyEvent({
    state: opening,
    event: {
      type: "limits_changed",
      openLimit: false,
      closedLimit: true,
    },
    configuration: { ...roofConfiguration, enabled: true },
  });

  assert.equal(transition.kind, "immediate");
  assert.equal(transition.state.movement, "opening");
  assert.equal(transition.state.componentStatus, "ready");
});

test("latches a local runtime fault without any network decision", () => {
  const opening = {
    ...initialWindowSafetyState({ enabled: true }),
    movement: "opening" as const,
    position: "unknown" as const,
    motionStartedAtMs: 1_000,
  };
  const transition = planWindowSafetyEvent({
    state: opening,
    event: { type: "tick", nowMs: 121_000 },
    configuration: { ...roofConfiguration, enabled: true },
  });

  assert.equal(transition.kind, "requires_output_confirmation");
  assert.equal(transition.action, "all_off");
  assert.equal(transition.onConfirmed.componentStatus, "fault_latched");
  assert.equal(
    transition.onConfirmed.faultCode,
    "maximum_runtime_exceeded",
  );
  assert.equal(transition.onConfirmed.position, "unknown");
});

test("fails closed when the monotonic runtime clock moves backwards", () => {
  const opening = {
    ...initialWindowSafetyState({ enabled: true }),
    movement: "opening" as const,
    position: "unknown" as const,
    motionStartedAtMs: 2_000,
  };
  const transition = planWindowSafetyEvent({
    state: opening,
    event: { type: "tick", nowMs: 1_999 },
    configuration: { ...roofConfiguration, enabled: true },
  });

  assert.equal(transition.kind, "requires_output_confirmation");
  assert.equal(transition.action, "all_off");
  assert.equal(transition.onConfirmed.componentStatus, "fault_latched");
  assert.equal(transition.onConfirmed.faultCode, "configuration_invalid");
});

test("starts the pending direction only after the interlock delay", () => {
  const waiting = {
    ...initialWindowSafetyState({
      enabled: true,
      openLimit: false,
      closedLimit: false,
      lastSequence: 8,
    }),
    position: "partially_open" as const,
    pendingDirection: "close" as const,
    interlockUntilMs: 2_000,
  };

  const early = planWindowSafetyEvent({
    state: waiting,
    event: { type: "tick", nowMs: 1_999 },
    configuration: { ...roofConfiguration, enabled: true },
  });
  assert.equal(early.kind, "immediate");
  assert.equal(early.state.movement, "stopped");

  const due = planWindowSafetyEvent({
    state: waiting,
    event: { type: "tick", nowMs: 2_000 },
    configuration: { ...roofConfiguration, enabled: true },
  });
  assert.equal(due.kind, "requires_output_confirmation");
  assert.equal(due.action, "drive_close");
  assert.equal(due.onConfirmed.movement, "closing");
  assert.equal(due.onConfirmed.pendingDirection, null);
});

test("emergency stop and disable both require confirmed all-off", () => {
  const moving = {
    ...initialWindowSafetyState({ enabled: true }),
    movement: "opening" as const,
    position: "partially_open" as const,
    motionStartedAtMs: 100,
  };

  const emergency = planWindowSafetyEvent({
    state: moving,
    event: { type: "emergency_stop" },
    configuration: { ...roofConfiguration, enabled: true },
  });
  assert.equal(emergency.kind, "requires_output_confirmation");
  assert.equal(emergency.action, "all_off");
  assert.equal(emergency.onConfirmed.componentStatus, "emergency_stopped");
  assert.equal(emergency.onConfirmed.movement, "stopped");

  const disabled = planWindowSafetyEvent({
    state: moving,
    event: { type: "configuration_disabled" },
    configuration: { ...roofConfiguration, enabled: true },
  });
  assert.equal(disabled.kind, "requires_output_confirmation");
  assert.equal(disabled.action, "all_off");
  assert.equal(disabled.onConfirmed.componentStatus, "disabled");
});

test("keeps roof and side state fully independent", () => {
  const roof = initialWindowSafetyState({
    enabled: true,
    openLimit: false,
    closedLimit: true,
  });
  const side = initialWindowSafetyState({ enabled: true });

  const roofDecision = planWindowCommand({
    state: roof,
    command: { id: "roof-open", operation: "open", sequence: 1 },
    configuration: { ...roofConfiguration, enabled: true },
    nowMs: 1_000,
  });

  assert.equal(roofDecision.kind, "requires_output_confirmation");
  assert.equal(roofDecision.onConfirmed.state.movement, "opening");
  assert.deepEqual(side, initialWindowSafetyState({ enabled: true }));
});
