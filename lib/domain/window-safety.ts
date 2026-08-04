export const WINDOW_COMPONENT_STATUSES = [
  "disabled",
  "ready",
  "fault_latched",
  "emergency_stopped",
] as const;

export type WindowComponentStatus =
  (typeof WINDOW_COMPONENT_STATUSES)[number];

export const WINDOW_MOVEMENTS = ["stopped", "opening", "closing"] as const;
export type WindowMovement = (typeof WINDOW_MOVEMENTS)[number];

export const WINDOW_POSITIONS = [
  "unknown",
  "open",
  "closed",
  "partially_open",
] as const;

export type WindowPosition = (typeof WINDOW_POSITIONS)[number];
export type WindowDirection = "open" | "close";
export type WindowPolicyKind = "roof" | "side";

export const WINDOW_FAULT_CODES = [
  "relay_unavailable",
  "relay_write_failed",
  "direction_interlock",
  "conflicting_limits",
  "unexpected_limit",
  "maximum_runtime_exceeded",
  "sensor_unavailable",
  "configuration_invalid",
  "emergency_stop",
] as const;

export type WindowFaultCode = (typeof WINDOW_FAULT_CODES)[number];

export type WindowSafetyState = {
  componentStatus: WindowComponentStatus;
  movement: WindowMovement;
  position: WindowPosition;
  pendingDirection: WindowDirection | null;
  faultCode: WindowFaultCode | null;
  openLimit: boolean | null;
  closedLimit: boolean | null;
  motionStartedAtMs: number | null;
  interlockUntilMs: number | null;
  lastSequence: number;
};

export type WindowSafetyConfiguration = {
  enabled: boolean;
  policy: WindowPolicyKind;
  directionChangeDelayMs: number;
  maximumOpeningTimeMs: number;
  maximumClosingTimeMs: number;
  limitSensorsRequired: boolean;
};

export type WindowCommandOperation = "open" | "stop" | "close";

export type WindowSafetyCommand = {
  id: string;
  operation: WindowCommandOperation;
  sequence: number;
};

export type WindowSafetyAction = "all_off" | "drive_open" | "drive_close";

export type WindowAcknowledgementStatus =
  | "applied"
  | "already_applied"
  | "superseded"
  | "rejected"
  | "failed";

export type WindowAcknowledgementReason =
  | "component_disabled"
  | "fault_latched"
  | "emergency_stop"
  | "sensor_unavailable"
  | "configuration_invalid"
  | "stale_sequence"
  | "relay_write_failed";

export type WindowActualState = Pick<
  WindowSafetyState,
  | "componentStatus"
  | "movement"
  | "position"
  | "openLimit"
  | "closedLimit"
  | "faultCode"
>;

export type WindowSafetyAcknowledgement = {
  commandId: string;
  sequence: number;
  status: WindowAcknowledgementStatus;
  reason?: WindowAcknowledgementReason;
  actualState: WindowActualState;
};

export type WindowImmediateDecision = {
  kind: "immediate";
  actions: [];
  state: WindowSafetyState;
  acknowledgement: WindowSafetyAcknowledgement;
};

export type WindowOutputDecision = {
  kind: "requires_output_confirmation";
  action: WindowSafetyAction;
  onConfirmed: {
    state: WindowSafetyState;
    acknowledgement: WindowSafetyAcknowledgement;
  };
  onFailure: {
    state: WindowSafetyState;
    acknowledgement: WindowSafetyAcknowledgement;
  };
};

export type WindowCommandDecision =
  | WindowImmediateDecision
  | WindowOutputDecision;

export function initialWindowSafetyState(args: {
  enabled: boolean;
  openLimit?: boolean | null;
  closedLimit?: boolean | null;
  lastSequence?: number;
  persistedFault?: WindowFaultCode | null;
}): WindowSafetyState {
  const openLimit = args.openLimit ?? null;
  const closedLimit = args.closedLimit ?? null;
  const persistedFault = args.persistedFault ?? null;

  return {
    componentStatus: persistedFault
      ? "fault_latched"
      : args.enabled
        ? "ready"
        : "disabled",
    movement: "stopped",
    position: positionFromLimits(openLimit, closedLimit),
    pendingDirection: null,
    faultCode: persistedFault,
    openLimit,
    closedLimit,
    motionStartedAtMs: null,
    interlockUntilMs: null,
    lastSequence: args.lastSequence ?? 0,
  };
}

export function validateWindowSafetyState(
  state: WindowSafetyState,
): string[] {
  const violations: string[] = [];

  if (!Number.isSafeInteger(state.lastSequence) || state.lastSequence < 0) {
    violations.push("invalid_sequence");
  }
  if (
    state.componentStatus !== "ready" &&
    state.movement !== "stopped"
  ) {
    violations.push("inactive_component_moving");
  }
  if (state.movement !== "stopped" && state.pendingDirection !== null) {
    violations.push("moving_with_pending_direction");
  }
  if (state.movement === "stopped" && state.motionStartedAtMs !== null) {
    violations.push("stopped_with_motion_timer");
  }
  if (state.movement !== "stopped" && state.motionStartedAtMs === null) {
    violations.push("moving_without_motion_timer");
  }
  if (state.pendingDirection === null && state.interlockUntilMs !== null) {
    violations.push("interlock_without_pending_direction");
  }
  if (state.pendingDirection !== null && state.interlockUntilMs === null) {
    violations.push("pending_direction_without_interlock");
  }
  if (state.componentStatus === "fault_latched" && state.faultCode === null) {
    violations.push("fault_without_code");
  }
  if (
    state.componentStatus !== "fault_latched" &&
    state.componentStatus !== "emergency_stopped" &&
    state.faultCode !== null
  ) {
    violations.push("fault_code_without_fault_status");
  }
  if (state.openLimit === true && state.closedLimit === true) {
    violations.push("conflicting_limits");
  }
  if (state.position === "open" && state.openLimit === false) {
    violations.push("open_position_conflicts_with_limit");
  }
  if (state.position === "closed" && state.closedLimit === false) {
    violations.push("closed_position_conflicts_with_limit");
  }

  return violations;
}

export function isValidWindowSafetyConfiguration(
  configuration: WindowSafetyConfiguration,
): boolean {
  return (
    Number.isSafeInteger(configuration.directionChangeDelayMs) &&
    configuration.directionChangeDelayMs >= 0 &&
    Number.isSafeInteger(configuration.maximumOpeningTimeMs) &&
    configuration.maximumOpeningTimeMs > 0 &&
    Number.isSafeInteger(configuration.maximumClosingTimeMs) &&
    configuration.maximumClosingTimeMs > 0 &&
    (configuration.policy !== "roof" ||
      configuration.limitSensorsRequired)
  );
}

export function planWindowCommand(args: {
  state: WindowSafetyState;
  command: WindowSafetyCommand;
  configuration: WindowSafetyConfiguration;
  nowMs: number;
}): WindowCommandDecision {
  const { state, command, configuration, nowMs } = args;

  if (!isValidCommand(command) || !isSafeMonotonicTime(nowMs)) {
    return immediate(
      state,
      command,
      "rejected",
      "configuration_invalid",
    );
  }

  // STOP is a safety action, not a normal ordered movement. It must reach the
  // abstract output boundary before sequence, enabled, fault or mode checks.
  if (command.operation === "stop") {
    const stoppedState = stopState(state, command.sequence);
    const status = sequenceStatus(command.sequence, state.lastSequence);
    return outputDecision(
      "all_off",
      stoppedState,
      acknowledgement(
        command,
        status,
        stoppedState,
        status === "superseded" ? "stale_sequence" : undefined,
      ),
      command,
      state,
    );
  }

  if (command.sequence < state.lastSequence) {
    return immediate(
      state,
      command,
      "superseded",
      "stale_sequence",
    );
  }
  if (command.sequence === state.lastSequence) {
    return immediate(state, command, "already_applied");
  }
  if (!isValidWindowSafetyConfiguration(configuration)) {
    return immediate(
      state,
      command,
      "rejected",
      "configuration_invalid",
    );
  }
  if (!configuration.enabled || state.componentStatus === "disabled") {
    return immediate(
      state,
      command,
      "rejected",
      "component_disabled",
    );
  }
  if (state.componentStatus === "fault_latched") {
    return immediate(state, command, "rejected", "fault_latched");
  }
  if (state.componentStatus === "emergency_stopped") {
    return immediate(state, command, "rejected", "emergency_stop");
  }
  if (
    configuration.limitSensorsRequired &&
    (state.openLimit === null || state.closedLimit === null)
  ) {
    return immediate(
      state,
      command,
      "rejected",
      "sensor_unavailable",
    );
  }

  const direction: WindowDirection = command.operation;
  const targetLimit = direction === "open" ? state.openLimit : state.closedLimit;
  if (targetLimit === true) {
    const atTarget = {
      ...state,
      movement: "stopped" as const,
      position: direction === "open" ? ("open" as const) : ("closed" as const),
      pendingDirection: null,
      motionStartedAtMs: null,
      interlockUntilMs: null,
      lastSequence: command.sequence,
    };
    return immediate(atTarget, command, "applied");
  }

  const requestedMovement = direction === "open" ? "opening" : "closing";
  if (state.movement === requestedMovement) {
    const continuing = { ...state, lastSequence: command.sequence };
    return immediate(continuing, command, "applied");
  }

  if (state.movement !== "stopped") {
    const waiting = {
      ...stopState(state, command.sequence),
      componentStatus: "ready" as const,
      pendingDirection: direction,
      interlockUntilMs: nowMs + configuration.directionChangeDelayMs,
    };
    return outputDecision(
      "all_off",
      waiting,
      acknowledgement(command, "applied", waiting),
      command,
      state,
    );
  }

  const moving = startMovement(state, direction, command.sequence, nowMs);
  return outputDecision(
    direction === "open" ? "drive_open" : "drive_close",
    moving,
    acknowledgement(command, "applied", moving),
    command,
    state,
  );
}

function outputDecision(
  action: WindowSafetyAction,
  confirmedState: WindowSafetyState,
  confirmedAcknowledgement: WindowSafetyAcknowledgement,
  command: WindowSafetyCommand,
  previousState: WindowSafetyState,
): WindowOutputDecision {
  const failureState: WindowSafetyState = {
    ...previousState,
    componentStatus: "fault_latched",
    movement: "stopped",
    position:
      previousState.movement === "stopped"
        ? previousState.position
        : conservativeStoppedPosition(previousState),
    pendingDirection: null,
    faultCode: "relay_write_failed",
    motionStartedAtMs: null,
    interlockUntilMs: null,
  };

  return {
    kind: "requires_output_confirmation",
    action,
    onConfirmed: {
      state: confirmedState,
      acknowledgement: confirmedAcknowledgement,
    },
    onFailure: {
      state: failureState,
      acknowledgement: acknowledgement(
        command,
        "failed",
        failureState,
        "relay_write_failed",
      ),
    },
  };
}

function immediate(
  state: WindowSafetyState,
  command: WindowSafetyCommand,
  status: WindowAcknowledgementStatus,
  reason?: WindowAcknowledgementReason,
): WindowImmediateDecision {
  return {
    kind: "immediate",
    actions: [],
    state,
    acknowledgement: acknowledgement(command, status, state, reason),
  };
}

function acknowledgement(
  command: WindowSafetyCommand,
  status: WindowAcknowledgementStatus,
  state: WindowSafetyState,
  reason?: WindowAcknowledgementReason,
): WindowSafetyAcknowledgement {
  return {
    commandId: command.id,
    sequence: command.sequence,
    status,
    ...(reason === undefined ? {} : { reason }),
    actualState: actualState(state),
  };
}

function actualState(state: WindowSafetyState): WindowActualState {
  return {
    componentStatus: state.componentStatus,
    movement: state.movement,
    position: state.position,
    openLimit: state.openLimit,
    closedLimit: state.closedLimit,
    faultCode: state.faultCode,
  };
}

function stopState(
  state: WindowSafetyState,
  sequence: number,
): WindowSafetyState {
  return {
    ...state,
    movement: "stopped",
    position: conservativeStoppedPosition(state),
    pendingDirection: null,
    motionStartedAtMs: null,
    interlockUntilMs: null,
    lastSequence: Math.max(state.lastSequence, sequence),
  };
}

function startMovement(
  state: WindowSafetyState,
  direction: WindowDirection,
  sequence: number,
  nowMs: number,
): WindowSafetyState {
  return {
    ...state,
    componentStatus: "ready",
    movement: direction === "open" ? "opening" : "closing",
    position:
      state.position === "unknown" ? "unknown" : "partially_open",
    pendingDirection: null,
    faultCode: null,
    motionStartedAtMs: nowMs,
    interlockUntilMs: null,
    lastSequence: sequence,
  };
}

function conservativeStoppedPosition(
  state: WindowSafetyState,
): WindowPosition {
  if (state.movement === "stopped") return state.position;
  return state.position === "unknown" ? "unknown" : "partially_open";
}

function sequenceStatus(
  sequence: number,
  lastSequence: number,
): "applied" | "already_applied" | "superseded" {
  if (sequence < lastSequence) return "superseded";
  if (sequence === lastSequence) return "already_applied";
  return "applied";
}

function isValidCommand(command: WindowSafetyCommand): boolean {
  return (
    command.id.length > 0 &&
    Number.isSafeInteger(command.sequence) &&
    command.sequence > 0
  );
}

function isSafeMonotonicTime(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function positionFromLimits(
  openLimit: boolean | null,
  closedLimit: boolean | null,
): WindowPosition {
  if (openLimit === true && closedLimit !== true) return "open";
  if (closedLimit === true && openLimit !== true) return "closed";
  return "unknown";
}
