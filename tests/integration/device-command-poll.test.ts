import assert from "node:assert/strict";
import test from "node:test";

import type {
  CommandAcknowledgement,
  CommandActuator,
} from "../../lib/domain/device-command.ts";
import { hashDeviceSecret } from "../../lib/domain/device-auth.ts";
import {
  executeDeviceCommandPoll,
  type DeviceCommandPollRepository,
} from "../../lib/services/device-command-poll.ts";

const secret = "C3-test-secret-not-used-by-a-device";
const now = new Date("2026-07-31T12:00:00.000Z");

function request(acknowledgements: CommandAcknowledgement[] = []) {
  return {
    protocol_version: 1,
    firmware_version: "1.3.1",
    last_applied_sequences: {
      watering: 0,
      roof_window: 0,
      side_window: 0,
    },
    acknowledgements,
  };
}

function storedCommand(
  actuator: CommandActuator,
  sequence: number,
) {
  return {
    id: `${actuator}-${sequence}`,
    protocol_version: 1,
    device_id: "device-1",
    actuator,
    command: actuator === "watering" ? "set" : "move",
    sequence,
    payload:
      actuator === "watering"
        ? { state: "on" }
        : { action: "stop" },
    created_at: "2026-07-31T11:59:00.000Z",
    expires_at: "2026-07-31T12:02:00.000Z",
  };
}

function repository(
  commands: Partial<Record<CommandActuator, unknown>> = {},
) {
  const delivered: string[] = [];
  const acknowledgements: CommandAcknowledgement[] = [];
  const value: DeviceCommandPollRepository = {
    async findDevice(deviceId) {
      return deviceId === "device-1"
        ? {
            id: "device-1",
            active: true,
            secret_hash: hashDeviceSecret(secret),
          }
        : null;
    },
    async acknowledge(deviceId, values) {
      if (deviceId !== "device-1") return false;
      acknowledgements.push(...values);
      return true;
    },
    async findLatestOpenCommand(deviceId, actuator) {
      return deviceId === "device-1" ? commands[actuator] ?? null : null;
    },
    async markDelivered(deviceId, commandId) {
      assert.equal(deviceId, "device-1");
      delivered.push(commandId);
    },
  };

  return { value, delivered, acknowledgements };
}

test("returns at most one validated command per core actuator", async () => {
  const fake = repository({
    watering: storedCommand("watering", 3),
    roof_window: storedCommand("roof_window", 5),
    side_window: storedCommand("side_window", 7),
  });
  const result = await executeDeviceCommandPoll({
    credentials: { deviceId: "device-1", deviceSecret: secret },
    body: request(),
    repository: fake.value,
    now,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.poll_after_ms, 1_500);
  assert.deepEqual(
    result.body.commands.map((command) => command.actuator),
    ["watering", "roof_window", "side_window"],
  );
  assert.deepEqual(fake.delivered, [
    "watering-3",
    "roof_window-5",
    "side_window-7",
  ]);
});

test("accepts and forwards separate acknowledgements", async () => {
  const values: CommandAcknowledgement[] = [
    {
      command_id: "watering-3",
      actuator: "watering",
      sequence: 3,
      status: "applied",
      actual_state: { state: "on" },
    },
    {
      command_id: "roof-5",
      actuator: "roof_window",
      sequence: 5,
      status: "rejected",
      reason: "component_disabled",
      actual_state: {
        position: "disabled",
        movement: "stopped",
      },
    },
  ];
  const fake = repository();
  const result = await executeDeviceCommandPoll({
    credentials: { deviceId: "device-1", deviceSecret: secret },
    body: request(values),
    repository: fake.value,
    now,
  });

  assert.equal(result.status, 200);
  assert.deepEqual(fake.acknowledgements, values);
});

test("rejects a cross-device or mismatched acknowledgement batch", async () => {
  const fake = repository();
  fake.value.acknowledge = async () => false;

  const result = await executeDeviceCommandPoll({
    credentials: { deviceId: "device-1", deviceSecret: secret },
    body: request([
      {
        command_id: "foreign-command",
        actuator: "watering",
        sequence: 1,
        status: "applied",
        actual_state: { state: "on" },
      },
    ]),
    repository: fake.value,
    now,
  });

  assert.deepEqual(result, {
    status: 409,
    body: { error: "acknowledgement_not_accepted" },
  });
});

test("rejects missing, unknown, disabled and invalid device credentials", async () => {
  for (const credentials of [
    null,
    { deviceId: "unknown", deviceSecret: secret },
    { deviceId: "device-1", deviceSecret: "wrong" },
  ]) {
    const fake = repository();
    const result = await executeDeviceCommandPoll({
      credentials,
      body: request(),
      repository: fake.value,
      now,
    });

    assert.equal(result.status, 401);
    assert.deepEqual(fake.delivered, []);
  }

  const fake = repository();
  fake.value.findDevice = async () => ({
    id: "device-1",
    active: false,
    secret_hash: hashDeviceSecret(secret),
  });
  const disabled = await executeDeviceCommandPoll({
    credentials: { deviceId: "device-1", deviceSecret: secret },
    body: request(),
    repository: fake.value,
    now,
  });
  assert.equal(disabled.status, 401);
});

test("fails closed when a stored command violates the domain", async () => {
  const fake = repository({
    watering: {
      ...storedCommand("watering", 3),
      payload: { state: "invalid" },
    },
  });
  const result = await executeDeviceCommandPoll({
    credentials: { deviceId: "device-1", deviceSecret: secret },
    body: request(),
    repository: fake.value,
    now,
  });

  assert.deepEqual(result, {
    status: 500,
    body: { error: "invalid_stored_command" },
  });
  assert.deepEqual(fake.delivered, []);
});

test("invalid request data does not acknowledge or deliver commands", async () => {
  const fake = repository({
    watering: storedCommand("watering", 3),
  });
  const result = await executeDeviceCommandPoll({
    credentials: { deviceId: "device-1", deviceSecret: secret },
    body: { ...request(), protocol_version: 2 },
    repository: fake.value,
    now,
  });

  assert.equal(result.status, 400);
  assert.deepEqual(fake.acknowledgements, []);
  assert.deepEqual(fake.delivered, []);
});
