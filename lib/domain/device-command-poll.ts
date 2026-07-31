import {
  COMMAND_ACTUATORS,
  COMMAND_PROTOCOL_VERSION,
  validateCommandAcknowledgement,
  type CommandAcknowledgement,
  type CommandActuator,
} from "./device-command.ts";

export const COMMAND_POLL_AFTER_MS = 1_500;
export const MAX_ACKNOWLEDGEMENTS_PER_POLL = 20;

export type DeviceCommandPollRequest = {
  protocolVersion: typeof COMMAND_PROTOCOL_VERSION;
  firmwareVersion: string | null;
  lastAppliedSequences: Record<CommandActuator, number>;
  acknowledgements: CommandAcknowledgement[];
};

export type DeviceCommandPollValidation =
  | { ok: true; request: DeviceCommandPollRequest }
  | { ok: false; error: "invalid_poll_request" };

export function validateDeviceCommandPollRequest(
  value: unknown,
): DeviceCommandPollValidation {
  if (!isRecord(value)) return invalid();
  if (value.protocol_version !== COMMAND_PROTOCOL_VERSION) return invalid();

  if (
    value.firmware_version !== undefined &&
    value.firmware_version !== null &&
    (
      typeof value.firmware_version !== "string" ||
      value.firmware_version.length === 0 ||
      value.firmware_version.length > 40
    )
  ) {
    return invalid();
  }

  if (!isRecord(value.last_applied_sequences)) return invalid();
  if (
    Object.keys(value.last_applied_sequences).length !==
      COMMAND_ACTUATORS.length
  ) {
    return invalid();
  }

  const lastAppliedSequences = {} as Record<CommandActuator, number>;
  for (const actuator of COMMAND_ACTUATORS) {
    const sequence = value.last_applied_sequences[actuator];
    if (!Number.isSafeInteger(sequence) || Number(sequence) < 0) {
      return invalid();
    }
    lastAppliedSequences[actuator] = Number(sequence);
  }

  if (!Array.isArray(value.acknowledgements)) return invalid();
  if (value.acknowledgements.length > MAX_ACKNOWLEDGEMENTS_PER_POLL) {
    return invalid();
  }

  const acknowledgements: CommandAcknowledgement[] = [];
  const acknowledgedIds = new Set<string>();

  for (const candidate of value.acknowledgements) {
    const result = validateCommandAcknowledgement(candidate);
    if (!result.ok) return invalid();
    if (acknowledgedIds.has(result.acknowledgement.command_id)) {
      return invalid();
    }
    acknowledgedIds.add(result.acknowledgement.command_id);
    acknowledgements.push(result.acknowledgement);
  }

  return {
    ok: true,
    request: {
      protocolVersion: COMMAND_PROTOCOL_VERSION,
      firmwareVersion:
        typeof value.firmware_version === "string"
          ? value.firmware_version
          : null,
      lastAppliedSequences,
      acknowledgements,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(): DeviceCommandPollValidation {
  return { ok: false, error: "invalid_poll_request" };
}
