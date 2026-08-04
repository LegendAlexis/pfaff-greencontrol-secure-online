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

function positionFromLimits(
  openLimit: boolean | null,
  closedLimit: boolean | null,
): WindowPosition {
  if (openLimit === true && closedLimit !== true) return "open";
  if (closedLimit === true && openLimit !== true) return "closed";
  return "unknown";
}
