import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

import { NextRequest } from "next/server";

import { POST } from "../../app/api/device/commands/poll/route.ts";
import type {
  CommandAcknowledgement,
  CommandActuator,
  DeviceCommand,
} from "../../lib/domain/device-command.ts";
import { hashDeviceSecret } from "../../lib/domain/device-auth.ts";
import { createAdminClient } from "../../lib/supabase/admin.ts";

const EXPECTED_STAGING_HOST = "iacplyydjtiirghwixys.supabase.co";
const FIXTURE_GREENHOUSE_ID = -9223372036854774999;
const FIXTURE_NAME = "C3.5 isolated staging validation";

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!configuredUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "C3.5 ENVIRONMENT GATE FAILED: Staging URL or service-role key is missing",
  );
}

const actualHost = new URL(configuredUrl).hostname;
if (actualHost !== EXPECTED_STAGING_HOST) {
  throw new Error(
    `C3.5 IDENTITY GATE FAILED: expected ${EXPECTED_STAGING_HOST}, actual ${actualHost}`,
  );
}

const admin = createAdminClient();
const deviceA = {
  id: randomUUID(),
  secret: randomBytes(32).toString("base64url"),
};
const deviceB = {
  id: randomUUID(),
  secret: randomBytes(32).toString("base64url"),
};
const fixtureDeviceIds = [deviceA.id, deviceB.id];

type InsertedCommand = {
  id: string;
  actuator: CommandActuator;
  sequence: number;
};

type PollResponseBody =
  | {
      ok: true;
      commands: DeviceCommand[];
    }
  | {
      error: string;
    };

let fixturesCreated = false;

try {
  console.log("C3.5 API PHASE 1: STAGING IDENTITY PASSED");
  await createFixtures();
  fixturesCreated = true;
  console.log("C3.5 API PHASE 2: FIXTURES CREATED");

  const commands = await createCommands();
  console.log("C3.5 API PHASE 3: THREE ACTUATORS CREATED");

  const latest = latestByActuator(commands, deviceA.id);
  const firstPoll = await poll(deviceA, []);
  assert.equal(firstPoll.status, 200);
  assert.ok("commands" in firstPoll.body);
  assert.equal(firstPoll.body.commands.length, 3);
  assert.deepEqual(
    new Set(firstPoll.body.commands.map((command) => command.actuator)),
    new Set(["watering", "roof_window", "side_window"]),
  );
  assert.deepEqual(
    new Set(firstPoll.body.commands.map((command) => command.id)),
    new Set([...latest.values()].map((command) => command.id)),
  );
  assert.ok(
    firstPoll.body.commands.every(
      (command) => command.device_id === deviceA.id,
    ),
  );
  console.log("C3.5 API PHASE 4: DEVICE ISOLATION AND ONE-PER-ACTOR PASSED");

  const repeatedPoll = await poll(deviceA, []);
  assert.equal(repeatedPoll.status, 200);
  assert.ok("commands" in repeatedPoll.body);
  assert.deepEqual(
    new Set(repeatedPoll.body.commands.map((command) => command.id)),
    new Set(firstPoll.body.commands.map((command) => command.id)),
  );
  console.log("C3.5 API PHASE 5: DELIVERY IDEMPOTENCY PASSED");

  const acknowledgements = acknowledgementsFor(firstPoll.body.commands);
  const acknowledgedPoll = await poll(deviceA, acknowledgements);
  assert.equal(acknowledgedPoll.status, 200);
  await assertStoredAcknowledgements(acknowledgements);
  console.log("C3.5 API PHASE 6: ACTOR-SPECIFIC ACKS PASSED");

  const repeatedAcknowledgement = await poll(deviceA, acknowledgements);
  assert.equal(repeatedAcknowledgement.status, 200);
  await assertStoredAcknowledgements(acknowledgements);
  console.log("C3.5 API PHASE 7: ACK IDEMPOTENCY PASSED");

  const foreignAcknowledgement = await poll(deviceB, [
    acknowledgements[0],
  ]);
  assert.equal(foreignAcknowledgement.status, 409);
  assert.deepEqual(foreignAcknowledgement.body, {
    error: "acknowledgement_not_accepted",
  });
  console.log("C3.5 API PHASE 8: CROSS-DEVICE ACK REJECTED");
} finally {
  await cleanupFixtures();
  if (fixturesCreated) {
    await assertFixturesRemoved();
  }
}

console.log("C3.5 API PHASE 9: FIXTURES REMOVED");
console.log("C3.5 STAGING INTEGRATION PASSED");

async function createFixtures() {
  const { error: greenhouseError } = await admin
    .from("greenhouses")
    .insert({
      id: FIXTURE_GREENHOUSE_ID,
      name: FIXTURE_NAME,
    });
  if (greenhouseError) throw greenhouseError;

  const { error: devicesError } = await admin.from("devices").insert([
    {
      id: deviceA.id,
      greenhouse_id: FIXTURE_GREENHOUSE_ID,
      name: `${FIXTURE_NAME} A`,
      secret_hash: hashDeviceSecret(deviceA.secret),
      active: true,
    },
    {
      id: deviceB.id,
      greenhouse_id: FIXTURE_GREENHOUSE_ID,
      name: `${FIXTURE_NAME} B`,
      secret_hash: hashDeviceSecret(deviceB.secret),
      active: true,
    },
  ]);
  if (devicesError) throw devicesError;
}

async function createCommands() {
  const expiresAt = new Date(Date.now() + 120_000).toISOString();
  const rows = [
    commandRow(deviceA.id, "watering", { state: "off" }, expiresAt),
    commandRow(deviceA.id, "watering", { state: "on" }, expiresAt),
    commandRow(deviceA.id, "roof_window", { action: "open" }, expiresAt),
    commandRow(deviceA.id, "roof_window", { action: "stop" }, expiresAt),
    commandRow(deviceA.id, "side_window", { action: "open" }, expiresAt),
    commandRow(deviceA.id, "side_window", { action: "stop" }, expiresAt),
    commandRow(deviceB.id, "watering", { state: "on" }, expiresAt),
  ];
  const { data, error } = await admin
    .from("device_commands")
    .insert(rows)
    .select("id,device_id,actuator,sequence");

  if (error) throw error;
  return data as Array<InsertedCommand & { device_id: string }>;
}

function commandRow(
  deviceId: string,
  actuator: CommandActuator,
  payload: Record<string, string>,
  expiresAt: string,
) {
  return {
    device_id: deviceId,
    actuator,
    command: actuator === "watering" ? "set" : "move",
    payload,
    expires_at: expiresAt,
  };
}

function latestByActuator(
  commands: Array<InsertedCommand & { device_id: string }>,
  deviceId: string,
) {
  const latest = new Map<CommandActuator, InsertedCommand>();
  for (const command of commands) {
    if (command.device_id !== deviceId) continue;
    const previous = latest.get(command.actuator);
    if (!previous || command.sequence > previous.sequence) {
      latest.set(command.actuator, command);
    }
  }
  return latest;
}

async function poll(
  device: { id: string; secret: string },
  acknowledgements: CommandAcknowledgement[],
) {
  const request = new NextRequest(
    "http://c35.local/api/device/commands/poll",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-device-id": device.id,
        "x-device-secret": device.secret,
      },
      body: JSON.stringify({
        protocol_version: 1,
        firmware_version: "c3.5-staging-test",
        last_applied_sequences: {
          watering: 0,
          roof_window: 0,
          side_window: 0,
        },
        acknowledgements,
      }),
    },
  );
  const response = await POST(request);
  return {
    status: response.status,
    body: await response.json() as PollResponseBody,
  };
}

function acknowledgementsFor(
  commands: Array<{
    id: string;
    actuator: CommandActuator;
    sequence: number;
  }>,
): CommandAcknowledgement[] {
  return commands.map((command) => {
    if (command.actuator === "watering") {
      return {
        command_id: command.id,
        actuator: "watering",
        sequence: command.sequence,
        status: "applied",
        actual_state: { state: "on" },
      };
    }

    return {
      command_id: command.id,
      actuator: command.actuator,
      sequence: command.sequence,
      status: "rejected",
      reason: "component_disabled",
      actual_state: {
        position: "disabled",
        movement: "stopped",
      },
    };
  });
}

async function assertStoredAcknowledgements(
  acknowledgements: CommandAcknowledgement[],
) {
  const ids = acknowledgements.map((acknowledgement) =>
    acknowledgement.command_id
  );
  const { data, error } = await admin
    .from("device_commands")
    .select("id,status,ack_reason,acknowledged_at")
    .in("id", ids);
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    id: string;
    status: string;
    ack_reason: string | null;
    acknowledged_at: string | null;
  }>;
  assert.equal(rows.length, acknowledgements.length);

  for (const acknowledgement of acknowledgements) {
    const storedRow = rows.find(
      (row) => row.id === acknowledgement.command_id,
    );
    assert.equal(storedRow?.status, acknowledgement.status);
    assert.equal(storedRow?.ack_reason, acknowledgement.reason ?? null);
    assert.ok(storedRow?.acknowledged_at);
  }
}

async function cleanupFixtures() {
  const { error: commandsError } = await admin
    .from("device_commands")
    .delete()
    .in("device_id", fixtureDeviceIds);
  if (commandsError) throw commandsError;

  const { error: devicesError } = await admin
    .from("devices")
    .delete()
    .in("id", fixtureDeviceIds);
  if (devicesError) throw devicesError;

  const { error: greenhouseError } = await admin
    .from("greenhouses")
    .delete()
    .eq("id", FIXTURE_GREENHOUSE_ID);
  if (greenhouseError) throw greenhouseError;
}

async function assertFixturesRemoved() {
  const [{ count: commandCount }, { count: deviceCount }, { count: ghCount }] =
    await Promise.all([
      admin
        .from("device_commands")
        .select("id", { count: "exact", head: true })
        .in("device_id", fixtureDeviceIds),
      admin
        .from("devices")
        .select("id", { count: "exact", head: true })
        .in("id", fixtureDeviceIds),
      admin
        .from("greenhouses")
        .select("id", { count: "exact", head: true })
        .eq("id", FIXTURE_GREENHOUSE_ID),
    ]);

  assert.equal(commandCount, 0);
  assert.equal(deviceCount, 0);
  assert.equal(ghCount, 0);
}
