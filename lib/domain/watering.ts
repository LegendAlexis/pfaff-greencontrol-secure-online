export const GREENCONTROL_TIME_ZONE = "Europe/Zurich";

export type WateringSchedule = {
  start_time: string;
  duration_minutes: number;
};

export type WateringDecisionInput = {
  wateringManualOverride: boolean;
  wateringTarget: boolean;
  schedules: WateringSchedule[];
  now: Date;
  status: string;
  temperature: number | null;
};

export type WateringDecision = {
  mode: "manual" | "schedule";
  scheduleActive: boolean;
  frostProtectionActive: boolean;
  effectiveTarget: boolean;
};

export function getCurrentMinutesInZurich(date: Date) {
  const parts = new Intl.DateTimeFormat("de-CH", {
    timeZone: GREENCONTROL_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(
    parts.find((part) => part.type === "hour")?.value ?? 0,
  );
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );

  return hour * 60 + minute;
}

export function parseStartTime(startTime: string) {
  const match = startTime.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

export function isScheduleCurrentlyActive(
  startTime: string,
  durationMinutes: number,
  currentMinutes: number,
) {
  const startMinutes = parseStartTime(startTime);

  if (startMinutes === null) return false;
  if (!Number.isFinite(durationMinutes)) return false;
  if (durationMinutes <= 0) return false;
  if (durationMinutes >= 24 * 60) return true;

  const endMinutes = startMinutes + durationMinutes;

  if (endMinutes <= 24 * 60) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  const endAfterMidnight = endMinutes - 24 * 60;
  return currentMinutes >= startMinutes || currentMinutes < endAfterMidnight;
}

export function evaluateWateringDecision(
  input: WateringDecisionInput,
): WateringDecision {
  const scheduleActive = input.wateringManualOverride
    ? false
    : input.schedules.some((schedule) =>
        isScheduleCurrentlyActive(
          schedule.start_time,
          schedule.duration_minutes,
          getCurrentMinutesInZurich(input.now),
        ),
      );

  const frostProtectionActive =
    input.status === "frost_protection" ||
    (input.temperature !== null && input.temperature <= 0);

  const effectiveTarget = frostProtectionActive
    ? false
    : input.wateringManualOverride
      ? input.wateringTarget
      : scheduleActive;

  return {
    mode: input.wateringManualOverride ? "manual" : "schedule",
    scheduleActive,
    frostProtectionActive,
    effectiveTarget,
  };
}
