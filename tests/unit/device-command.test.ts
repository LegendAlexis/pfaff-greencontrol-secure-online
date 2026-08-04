import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMAND_PROTOCOL_VERSION,
  evaluateDeviceCommand,
  initialCommandSequenceState,
  isSafeDisabledCommand,
  validateCommandAcknowledgement,
  validateDeviceCommand,
  type DeviceCommand,
} from "../../lib/domain/device-command.ts";

const createdAt = "2026-07-31T12:00:00.000Z";
const expiresAt = "2026-07-31T12:02:00.000Z";

function command(
  actuator: "watering" | "roof_window" | "side_window",
  payload: Record<string, unknown>,
  sequence = 1,
): Record<string, unknown> {
  return {
    id: `command-${actuator}-${sequence}`,
    protocol_version: COMMAND_PROTOCOL_VERSION,
    device_id: "device-1",
    actuator,
    command: actuator === "watering" ? "set" : "move",
    sequence,
    payload,
    created_at: createdAt,
    expires_at: expiresAt,
  };
}

function validCommand(value: unknown): DeviceCommand {
  const result = validateDeviceCommand(value);
  assert.equal(result.ok, true);
  return result.command;
}

test("models independent initial sequences for all core actuators", () => {
  assert.deepEqual(initialCommandSequenceState(), {
    watering: 0,
    roof_window: 0,
    side_window: 0,
  });
});

test("validates watering on and off commands", () => {
  for (const state of ["on", "off"]) {
    const result = validateDeviceCommand(command("watering", { state }));
    assert.equal(result.ok, true);
    assert.equal(result.command.actuator, "watering");
    assert.deepEqual(result.command.payload, { state });
  }
});

test("validates open, stop and close separately for both windows", () => {
  for (const actuator of ["roof_window", "side_window"] as const) {
    for (const action of ["open", "stop", "close"]) {
      const result = validateDeviceCommand(command(actuator, { action }));
      assert.equal(result.ok, true);
      assert.equal(result.command.actuator, actuator);
      assert.deepEqual(result.command.payload, { action });
    }
  }
});

test("rejects mismatched actuator, command and payload combinations", () => {
  const invalid = [
    command("watering", { action: "open" }),
    command("roof_window", { state: "on" }),
    { ...command("watering", { state: "on" }), command: "move" },
    { ...command("side_window", { action: "open" }), command: "set" },
    command("roof_window", { action: "half" }),
    command("watering", { state: "on", unexpected: true }),
  ];

  for (const value of invalid) {
    assert.deepEqual(validateDeviceCommand(value), {
      ok: false,
      reason: "invalid_payload",
    });
  }
});

test("rejects invalid protocol, identity, sequence and timestamps", () => {
  const baseline = command("watering", { state: "on" }) as Record<
    string,
    unknown
  >;
  const invalid = [
    { ...baseline, protocol_version: 2 },
    { ...baseline, id: "" },
    { ...baseline, device_id: "contains spaces" },
    { ...baseline, sequence: 0 },
    { ...baseline, sequence: 1.5 },
    { ...baseline, created_at: "not-a-date" },
    { ...baseline, expires_at: createdAt },
  ];

  for (const value of invalid) {
    assert.equal(validateDeviceCommand(value).ok, false);
  }
});

test("accepts canonical and PostgreSQL UTC command timestamps", () => {
  const timestamps = [
    ["2026-08-04T13:53:24.794Z", "2026-08-04T13:55:24.803Z"],
    [
      "2026-08-04T13:53:24.794888+00:00",
      "2026-08-04T13:55:24.803+00:00",
    ],
  ] as const;

  for (const [created_at, expires_at] of timestamps) {
    assert.equal(
      validateDeviceCommand({
        ...command("watering", { state: "on" }),
        created_at,
        expires_at,
      }).ok,
      true,
    );
  }
});

test("rejects unsupported timestamp variants", () => {
  const invalidTimestamps = [
    "2026-08-04T13:53:24.79+00:00",
    "2026-08-04T13:53:24.7948887+00:00",
    "2026-08-04T15:53:24.794+02:00",
    "2026-08-04 13:53:24.794+00:00",
  ];

  for (const created_at of invalidTimestamps) {
    assert.equal(
      validateDeviceCommand({
        ...command("watering", { state: "on" }),
        created_at,
      }).ok,
      false,
    );
  }
});

test("accepts a new command for an enabled actuator", () => {
  const value = validCommand(command("watering", { state: "on" }, 4));
  const decision = evaluateDeviceCommand(value, {
    enabled: true,
    lastAppliedSequence: 3,
    now: new Date("2026-07-31T12:01:00.000Z"),
  });

  assert.deepEqual(decision, { action: "apply", command: value });
});

test("treats the same per-actuator sequence as already applied", () => {
  const value = validCommand(command("roof_window", { action: "stop" }, 8));

  assert.deepEqual(
    evaluateDeviceCommand(value, {
      enabled: false,
      lastAppliedSequence: 8,
      now: new Date("2026-07-31T12:01:00.000Z"),
    }),
    { action: "ack_only", status: "already_applied" },
  );
});

test("supersedes an older per-actuator sequence", () => {
  const value = validCommand(command("side_window", { action: "open" }, 7));

  assert.deepEqual(
    evaluateDeviceCommand(value, {
      enabled: true,
      lastAppliedSequence: 8,
      now: new Date("2026-07-31T12:01:00.000Z"),
    }),
    {
      action: "ack_only",
      status: "superseded",
      reason: "stale_sequence",
    },
  );
});

test("rejects a new expired command without applying it", () => {
  const value = validCommand(command("watering", { state: "on" }, 4));

  assert.deepEqual(
    evaluateDeviceCommand(value, {
      enabled: true,
      lastAppliedSequence: 3,
      now: new Date(expiresAt),
    }),
    { action: "reject", status: "expired", reason: "expired" },
  );
});

test("disabled windows reject movement but always permit stop", () => {
  for (const actuator of ["roof_window", "side_window"] as const) {
    for (const action of ["open", "close"] as const) {
      const value = validCommand(command(actuator, { action }));
      assert.equal(isSafeDisabledCommand(value), false);
      assert.deepEqual(
        evaluateDeviceCommand(value, {
          enabled: false,
          lastAppliedSequence: 0,
          now: new Date("2026-07-31T12:01:00.000Z"),
        }),
        {
          action: "reject",
          status: "rejected",
          reason: "component_disabled",
        },
      );
    }

    const stop = validCommand(command(actuator, { action: "stop" }));
    assert.equal(isSafeDisabledCommand(stop), true);
    assert.equal(
      evaluateDeviceCommand(stop, {
        enabled: false,
        lastAppliedSequence: 0,
        now: new Date("2026-07-31T12:01:00.000Z"),
      }).action,
      "apply",
    );
  }
});

test("a disabled watering component permits off but rejects on", () => {
  const on = validCommand(command("watering", { state: "on" }));
  const off = validCommand(command("watering", { state: "off" }));
  const context = {
    enabled: false,
    lastAppliedSequence: 0,
    now: new Date("2026-07-31T12:01:00.000Z"),
  };

  assert.deepEqual(evaluateDeviceCommand(on, context), {
    action: "reject",
    status: "rejected",
    reason: "component_disabled",
  });
  assert.equal(evaluateDeviceCommand(off, context).action, "apply");
});

test("validates separate acknowledgements for watering and windows", () => {
  const acknowledgements = [
    {
      command_id: "watering-1",
      actuator: "watering",
      sequence: 1,
      status: "applied",
      actual_state: { state: "on" },
    },
    {
      command_id: "roof-1",
      actuator: "roof_window",
      sequence: 2,
      status: "rejected",
      reason: "component_disabled",
      actual_state: {
        position: "disabled",
        movement: "stopped",
        open_limit: false,
        closed_limit: false,
        fault: null,
      },
    },
    {
      command_id: "side-1",
      actuator: "side_window",
      sequence: 3,
      status: "applied",
      actual_state: {
        position: "stopped",
        movement: "stopped",
      },
    },
  ];

  for (const acknowledgement of acknowledgements) {
    assert.equal(validateCommandAcknowledgement(acknowledgement).ok, true);
  }
});

test("rejects acknowledgements with mismatched or unknown actual state", () => {
  const invalid = [
    {
      command_id: "watering-1",
      actuator: "watering",
      sequence: 1,
      status: "applied",
      actual_state: { position: "open" },
    },
    {
      command_id: "roof-1",
      actuator: "roof_window",
      sequence: 1,
      status: "applied",
      actual_state: { position: "open", movement: "moving" },
    },
    {
      command_id: "side-1",
      actuator: "side_window",
      sequence: 1,
      status: "unknown",
      actual_state: { position: "stopped", movement: "stopped" },
    },
  ];

  for (const acknowledgement of invalid) {
    assert.equal(validateCommandAcknowledgement(acknowledgement).ok, false);
  }
});

test("rejects acknowledgements with contradictory status and reason", () => {
  const baseline = {
    command_id: "watering-1",
    actuator: "watering",
    sequence: 1,
    actual_state: { state: "off" },
  };
  const invalid = [
    { ...baseline, status: "applied", reason: "component_disabled" },
    { ...baseline, status: "rejected" },
    { ...baseline, status: "expired", reason: "stale_sequence" },
    { ...baseline, status: "superseded", reason: "expired" },
    { ...baseline, status: "failed", reason: "frost_lock" },
  ];

  for (const acknowledgement of invalid) {
    assert.equal(validateCommandAcknowledgement(acknowledgement).ok, false);
  }
});
