import {
  COMMAND_ACTUATORS,
  COMMAND_PROTOCOL_VERSION,
  validateDeviceCommand,
  type CommandAcknowledgement,
  type CommandActuator,
  type DeviceCommand,
} from "../domain/device-command.ts";
import {
  COMMAND_POLL_AFTER_MS,
  validateDeviceCommandPollRequest,
} from "../domain/device-command-poll.ts";
import {
  isAuthorizedDevice,
  type DeviceCredentials,
} from "../domain/device-auth.ts";

export type CommandDevice = {
  id: string;
  active: boolean;
  secret_hash: string;
};

export type DeviceCommandPollRepository = {
  findDevice(deviceId: string): Promise<CommandDevice | null>;
  acknowledge(
    deviceId: string,
    acknowledgements: CommandAcknowledgement[],
    acknowledgedAt: string,
  ): Promise<boolean>;
  findLatestOpenCommand(
    deviceId: string,
    actuator: CommandActuator,
    now: string,
  ): Promise<unknown | null>;
  markDelivered(
    deviceId: string,
    commandId: string,
    deliveredAt: string,
  ): Promise<void>;
};

export type DeviceCommandPollResult =
  | {
      status: 200;
      body: {
        ok: true;
        protocol_version: typeof COMMAND_PROTOCOL_VERSION;
        server_time: string;
        poll_after_ms: number;
        commands: DeviceCommand[];
      };
    }
  | {
      status: 400 | 401 | 409 | 500;
      body: { error: string };
    };

export async function executeDeviceCommandPoll(args: {
  credentials: DeviceCredentials | null;
  body: unknown;
  repository: DeviceCommandPollRepository;
  now: Date;
}): Promise<DeviceCommandPollResult> {
  if (!args.credentials) {
    return { status: 401, body: { error: "device_credentials_missing" } };
  }

  const device = await args.repository.findDevice(args.credentials.deviceId);
  if (!isAuthorizedDevice(device, args.credentials.deviceSecret)) {
    return { status: 401, body: { error: "device_not_authorized" } };
  }

  const validation = validateDeviceCommandPollRequest(args.body);
  if (!validation.ok) {
    return { status: 400, body: { error: validation.error } };
  }

  const now = args.now.toISOString();
  const acknowledgementsAccepted = await args.repository.acknowledge(
    device.id,
    validation.request.acknowledgements,
    now,
  );

  if (!acknowledgementsAccepted) {
    return {
      status: 409,
      body: { error: "acknowledgement_not_accepted" },
    };
  }

  const candidates = await Promise.all(
    COMMAND_ACTUATORS.map((actuator) =>
      args.repository.findLatestOpenCommand(device.id, actuator, now),
    ),
  );
  const commands: DeviceCommand[] = [];

  for (const candidate of candidates) {
    if (candidate === null) continue;

    const command = validateDeviceCommand(candidate);
    if (!command.ok || command.command.device_id !== device.id) {
      return {
        status: 500,
        body: { error: "invalid_stored_command" },
      };
    }

    commands.push(command.command);
  }

  await Promise.all(
    commands.map((command) =>
      args.repository.markDelivered(device.id, command.id, now),
    ),
  );

  return {
    status: 200,
    body: {
      ok: true,
      protocol_version: COMMAND_PROTOCOL_VERSION,
      server_time: now,
      poll_after_ms: COMMAND_POLL_AFTER_MS,
      commands,
    },
  };
}
