export const COMMAND_PROTOCOL_VERSION = 1 as const;

export const COMMAND_ACTUATORS = [
  "watering",
  "roof_window",
  "side_window",
] as const;

export type CommandActuator = (typeof COMMAND_ACTUATORS)[number];
export type WateringState = "on" | "off";
export type WindowAction = "open" | "stop" | "close";
export type WindowPosition =
  | "disabled"
  | "open"
  | "closed"
  | "partially_open"
  | "opening"
  | "closing"
  | "stopped"
  | "unknown"
  | "error";
export type WindowMovement = "opening" | "closing" | "stopped";

type CommandBase = {
  id: string;
  protocol_version: typeof COMMAND_PROTOCOL_VERSION;
  device_id: string;
  sequence: number;
  created_at: string;
  expires_at: string;
};

export type WateringCommand = CommandBase & {
  actuator: "watering";
  command: "set";
  payload: { state: WateringState };
};

export type RoofWindowCommand = CommandBase & {
  actuator: "roof_window";
  command: "move";
  payload: { action: WindowAction };
};

export type SideWindowCommand = CommandBase & {
  actuator: "side_window";
  command: "move";
  payload: { action: WindowAction };
};

export type DeviceCommand =
  | WateringCommand
  | RoofWindowCommand
  | SideWindowCommand;

export type CommandSequenceState = Record<CommandActuator, number>;

export const COMMAND_ACK_STATUSES = [
  "applied",
  "already_applied",
  "rejected",
  "expired",
  "superseded",
  "unsupported",
  "failed",
] as const;

export type CommandAckStatus = (typeof COMMAND_ACK_STATUSES)[number];

export const COMMAND_ACK_REASONS = [
  "component_disabled",
  "frost_lock",
  "output_disabled",
  "relay_unavailable",
  "relay_write_failed",
  "invalid_payload",
  "stale_sequence",
  "unsupported_actuator",
  "unsupported_command",
  "expired",
] as const;

export type CommandAckReason = (typeof COMMAND_ACK_REASONS)[number];

type AcknowledgementBase = {
  command_id: string;
  sequence: number;
  status: CommandAckStatus;
  reason?: CommandAckReason;
};

export type WateringAcknowledgement = AcknowledgementBase & {
  actuator: "watering";
  actual_state: { state: WateringState };
};

export type WindowAcknowledgement = AcknowledgementBase & {
  actuator: "roof_window" | "side_window";
  actual_state: {
    position: WindowPosition;
    movement: WindowMovement;
    open_limit?: boolean;
    closed_limit?: boolean;
    fault?: string | null;
  };
};

export type CommandAcknowledgement =
  | WateringAcknowledgement
  | WindowAcknowledgement;

export type CommandValidationResult =
  | { ok: true; command: DeviceCommand }
  | { ok: false; reason: "invalid_payload" };

export type AcknowledgementValidationResult =
  | { ok: true; acknowledgement: CommandAcknowledgement }
  | { ok: false; reason: "invalid_payload" };

export type CommandDecision =
  | { action: "apply"; command: DeviceCommand }
  | {
      action: "ack_only";
      status: "already_applied" | "superseded";
      reason?: "stale_sequence";
    }
  | {
      action: "reject";
      status: "expired" | "rejected";
      reason: "expired" | "component_disabled";
    };

type CommandEvaluationContext = {
  enabled: boolean;
  lastAppliedSequence: number;
  now: Date;
};

export function initialCommandSequenceState(): CommandSequenceState {
  return {
    watering: 0,
    roof_window: 0,
    side_window: 0,
  };
}

export function validateDeviceCommand(
  value: unknown,
): CommandValidationResult {
  if (!isRecord(value)) return invalidCommand();
  if (value.protocol_version !== COMMAND_PROTOCOL_VERSION) {
    return invalidCommand();
  }
  if (!isIdentifier(value.id) || !isIdentifier(value.device_id)) {
    return invalidCommand();
  }
  if (!isPositiveSequence(value.sequence)) return invalidCommand();
  if (!isIsoDate(value.created_at) || !isIsoDate(value.expires_at)) {
    return invalidCommand();
  }
  if (Date.parse(value.expires_at) <= Date.parse(value.created_at)) {
    return invalidCommand();
  }

  const common = {
    id: value.id,
    protocol_version: COMMAND_PROTOCOL_VERSION,
    device_id: value.device_id,
    sequence: value.sequence,
    created_at: value.created_at,
    expires_at: value.expires_at,
  };

  if (
    value.actuator === "watering" &&
    value.command === "set" &&
    isExactRecord(value.payload, ["state"]) &&
    isOneOf(value.payload.state, ["on", "off"] as const)
  ) {
    return {
      ok: true,
      command: {
        ...common,
        actuator: "watering",
        command: "set",
        payload: { state: value.payload.state },
      },
    };
  }

  if (
    (value.actuator === "roof_window" ||
      value.actuator === "side_window") &&
    value.command === "move" &&
    isExactRecord(value.payload, ["action"]) &&
    isOneOf(value.payload.action, ["open", "stop", "close"] as const)
  ) {
    return {
      ok: true,
      command: {
        ...common,
        actuator: value.actuator,
        command: "move",
        payload: { action: value.payload.action },
      },
    };
  }

  return invalidCommand();
}

export function validateCommandAcknowledgement(
  value: unknown,
): AcknowledgementValidationResult {
  if (!isRecord(value)) return invalidAcknowledgement();
  if (!isIdentifier(value.command_id)) return invalidAcknowledgement();
  if (!isPositiveSequence(value.sequence)) return invalidAcknowledgement();
  if (!isOneOf(value.status, COMMAND_ACK_STATUSES)) {
    return invalidAcknowledgement();
  }
  if (
    value.reason !== undefined &&
    !isOneOf(value.reason, COMMAND_ACK_REASONS)
  ) {
    return invalidAcknowledgement();
  }
  if (!isAckReasonCompatible(value.status, value.reason)) {
    return invalidAcknowledgement();
  }
  if (!isRecord(value.actual_state)) return invalidAcknowledgement();

  const common = {
    command_id: value.command_id,
    sequence: value.sequence,
    status: value.status,
    ...(value.reason === undefined ? {} : { reason: value.reason }),
  };

  if (
    value.actuator === "watering" &&
    isExactRecord(value.actual_state, ["state"]) &&
    isOneOf(value.actual_state.state, ["on", "off"] as const)
  ) {
    return {
      ok: true,
      acknowledgement: {
        ...common,
        actuator: "watering",
        actual_state: { state: value.actual_state.state },
      },
    };
  }

  if (
    (value.actuator === "roof_window" ||
      value.actuator === "side_window") &&
    isWindowActualState(value.actual_state)
  ) {
    return {
      ok: true,
      acknowledgement: {
        ...common,
        actuator: value.actuator,
        actual_state: {
          position: value.actual_state.position,
          movement: value.actual_state.movement,
          ...(value.actual_state.open_limit === undefined
            ? {}
            : { open_limit: value.actual_state.open_limit }),
          ...(value.actual_state.closed_limit === undefined
            ? {}
            : { closed_limit: value.actual_state.closed_limit }),
          ...(value.actual_state.fault === undefined
            ? {}
            : { fault: value.actual_state.fault }),
        },
      },
    };
  }

  return invalidAcknowledgement();
}

export function evaluateDeviceCommand(
  command: DeviceCommand,
  context: CommandEvaluationContext,
): CommandDecision {
  if (command.sequence < context.lastAppliedSequence) {
    return {
      action: "ack_only",
      status: "superseded",
      reason: "stale_sequence",
    };
  }

  if (command.sequence === context.lastAppliedSequence) {
    return { action: "ack_only", status: "already_applied" };
  }

  if (Date.parse(command.expires_at) <= context.now.getTime()) {
    return {
      action: "reject",
      status: "expired",
      reason: "expired",
    };
  }

  if (!context.enabled && !isSafeDisabledCommand(command)) {
    return {
      action: "reject",
      status: "rejected",
      reason: "component_disabled",
    };
  }

  return { action: "apply", command };
}

export function isSafeDisabledCommand(command: DeviceCommand): boolean {
  if (command.actuator === "watering") {
    return command.payload.state === "off";
  }

  return command.payload.action === "stop";
}

function isWindowActualState(
  value: Record<string, unknown>,
): value is WindowAcknowledgement["actual_state"] {
  const allowedKeys = new Set([
    "position",
    "movement",
    "open_limit",
    "closed_limit",
    "fault",
  ]);

  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return false;
  if (
    !isOneOf(value.position, [
      "disabled",
      "open",
      "closed",
      "partially_open",
      "opening",
      "closing",
      "stopped",
      "unknown",
      "error",
    ] as const)
  ) {
    return false;
  }
  if (
    !isOneOf(
      value.movement,
      ["opening", "closing", "stopped"] as const,
    )
  ) {
    return false;
  }
  if (
    value.open_limit !== undefined &&
    typeof value.open_limit !== "boolean"
  ) {
    return false;
  }
  if (
    value.closed_limit !== undefined &&
    typeof value.closed_limit !== "boolean"
  ) {
    return false;
  }

  return (
    value.fault === undefined ||
    value.fault === null ||
    typeof value.fault === "string"
  );
}

function isAckReasonCompatible(
  status: CommandAckStatus,
  reason: unknown,
): reason is CommandAckReason | undefined {
  if (status === "applied" || status === "already_applied") {
    return reason === undefined;
  }

  if (!isOneOf(reason, COMMAND_ACK_REASONS)) return false;

  if (status === "expired") return reason === "expired";
  if (status === "superseded") return reason === "stale_sequence";
  if (status === "unsupported") {
    return (
      reason === "unsupported_actuator" ||
      reason === "unsupported_command"
    );
  }
  if (status === "failed") {
    return (
      reason === "relay_unavailable" ||
      reason === "relay_write_failed"
    );
  }

  return (
    reason === "component_disabled" ||
    reason === "frost_lock" ||
    reason === "output_disabled" ||
    reason === "invalid_payload"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExactRecord(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    actualKeys.every((key) => keys.includes(key))
  );
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9._:-]+$/.test(value)
  );
}

function isPositiveSequence(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const postgresUtc =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})\d{0,3}\+00:00$/.exec(
      value,
    );
  const canonical = postgresUtc ? `${postgresUtc[1]}Z` : value;
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString() === canonical
  );
}

function isOneOf<const T extends readonly unknown[]>(
  value: unknown,
  options: T,
): value is T[number] {
  return options.includes(value);
}

function invalidCommand(): CommandValidationResult {
  return { ok: false, reason: "invalid_payload" };
}

function invalidAcknowledgement(): AcknowledgementValidationResult {
  return { ok: false, reason: "invalid_payload" };
}
