import {
  evaluateWateringDecision,
  type WateringSchedule,
} from "./watering.ts";

export type HeartbeatBody = {
  temperature?: unknown;
  status?: unknown;
  firmware_version?: unknown;
  roof_window_open?: unknown;
  wall_window_open?: unknown;
  watering_on?: unknown;
};

export type NormalizedHeartbeat = {
  temperature: number | null;
  status: string;
  firmwareVersion: string | null;
  roofWindowOpen: boolean | null;
  wallWindowOpen: boolean | null;
  wateringOn: boolean | null;
};

export type HeartbeatGreenhouse = {
  auto_mode: boolean | null;
  roof_window_target: boolean | null;
  wall_window_target: boolean | null;
  watering_target: boolean | null;
  roof_manual_override: boolean | null;
  wall_manual_override: boolean | null;
  watering_manual_override: boolean | null;
};

export function normalizeHeartbeat(body: HeartbeatBody): NormalizedHeartbeat {
  return {
    temperature:
      typeof body.temperature === "number" &&
      body.temperature > -50 &&
      body.temperature < 80
        ? body.temperature
        : null,
    status:
      typeof body.status === "string"
        ? body.status.slice(0, 40)
        : "online",
    firmwareVersion:
      typeof body.firmware_version === "string"
        ? body.firmware_version.slice(0, 40)
        : null,
    roofWindowOpen:
      typeof body.roof_window_open === "boolean"
        ? body.roof_window_open
        : null,
    wallWindowOpen:
      typeof body.wall_window_open === "boolean"
        ? body.wall_window_open
        : null,
    wateringOn:
      typeof body.watering_on === "boolean"
        ? body.watering_on
        : null,
  };
}

export function createHeartbeatPersistence(
  heartbeat: NormalizedHeartbeat,
  greenhouseId: number,
  now: string,
) {
  const greenhouseUpdate: Record<string, unknown> = {
    last_seen: now,
    temperature: heartbeat.temperature,
    status: heartbeat.status,
  };

  if (heartbeat.wateringOn !== null) {
    greenhouseUpdate.watering_on = heartbeat.wateringOn;
  }

  return {
    deviceUpdate: {
      last_seen: now,
      firmware_version: heartbeat.firmwareVersion,
      updated_at: now,
    },
    greenhouseUpdate,
    sensorReading: {
      greenhouse_id: greenhouseId,
      temperature: heartbeat.temperature,
      roof_window_open: heartbeat.roofWindowOpen,
      wall_window_open: heartbeat.wallWindowOpen,
      watering_on: heartbeat.wateringOn,
      created_at: now,
    },
  };
}

export function createHeartbeatResponse(args: {
  greenhouseId: number;
  greenhouse: HeartbeatGreenhouse;
  heartbeat: NormalizedHeartbeat;
  schedules: WateringSchedule[];
  now: Date;
}) {
  const decision = evaluateWateringDecision({
    wateringManualOverride:
      args.greenhouse.watering_manual_override === true,
    wateringTarget: args.greenhouse.watering_target === true,
    schedules: args.schedules,
    now: args.now,
    status: args.heartbeat.status,
    temperature: args.heartbeat.temperature,
  });

  return {
    ok: true,
    server_time: args.now.toISOString(),
    greenhouse_id: args.greenhouseId,
    watering: {
      mode: decision.mode,
      schedule_active: decision.scheduleActive,
      frost_protection: decision.frostProtectionActive,
      effective_target: decision.effectiveTarget,
    },
    commands: {
      auto_mode: args.greenhouse.auto_mode,
      roof_window_target: args.greenhouse.roof_window_target,
      wall_window_target: args.greenhouse.wall_window_target,
      watering_target: decision.effectiveTarget,
      roof_manual_override: args.greenhouse.roof_manual_override,
      wall_manual_override: args.greenhouse.wall_manual_override,
      watering_manual_override: args.greenhouse.watering_manual_override,
    },
  };
}
