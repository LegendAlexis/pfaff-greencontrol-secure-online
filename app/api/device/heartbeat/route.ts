import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_ZONE = "Europe/Zurich";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function equalSecret(secret: string, hashHex: string) {
  const supplied = digest(secret);
  const stored = Buffer.from(hashHex, "hex");

  return (
    supplied.length === stored.length &&
    timingSafeEqual(supplied, stored)
  );
}

function getCurrentMinutesInZurich(date: Date) {
  const parts = new Intl.DateTimeFormat("de-CH", {
    timeZone: TIME_ZONE,
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

function parseStartTime(startTime: string) {
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

function isScheduleCurrentlyActive(
  startTime: string,
  durationMinutes: number,
  currentMinutes: number,
) {
  const startMinutes = parseStartTime(startTime);

  if (startMinutes === null) return false;
  if (!Number.isFinite(durationMinutes)) return false;
  if (durationMinutes <= 0) return false;

  // Bei einer Dauer von mindestens 24 Stunden ist der Zeitplan
  // während des gesamten Tages aktiv.
  if (durationMinutes >= 24 * 60) return true;

  const endMinutes = startMinutes + durationMinutes;

  // Normaler Zeitplan innerhalb desselben Tages:
  // beispielsweise 06:00 bis 06:10.
  if (endMinutes <= 24 * 60) {
    return (
      currentMinutes >= startMinutes &&
      currentMinutes < endMinutes
    );
  }

  // Zeitplan über Mitternacht:
  // beispielsweise 23:55 bis 00:10.
  const endAfterMidnight = endMinutes - 24 * 60;

  return (
    currentMinutes >= startMinutes ||
    currentMinutes < endAfterMidnight
  );
}

export async function POST(request: NextRequest) {
  try {
    const deviceId = request.headers
      .get("x-device-id")
      ?.trim();

    const deviceSecret = request.headers
      .get("x-device-secret")
      ?.trim();

    if (!deviceId || !deviceSecret) {
      return NextResponse.json(
        { error: "Gerätezugang fehlt" },
        { status: 401 },
      );
    }

    const admin = createAdminClient();

    const { data: device, error: deviceError } = await admin
      .from("devices")
      .select("id,greenhouse_id,secret_hash,active")
      .eq("id", deviceId)
      .maybeSingle();

    if (deviceError) throw deviceError;

    if (
      !device?.active ||
      !equalSecret(deviceSecret, device.secret_hash)
    ) {
      return NextResponse.json(
        { error: "Gerät nicht autorisiert" },
        { status: 401 },
      );
    }

    const body = await request.json();

    const temperature =
      typeof body.temperature === "number" &&
      body.temperature > -50 &&
      body.temperature < 80
        ? body.temperature
        : null;

    const status =
      typeof body.status === "string"
        ? body.status.slice(0, 40)
        : "online";

    const nowDate = new Date();
    const now = nowDate.toISOString();

    const reportedWateringOn =
      typeof body.watering_on === "boolean"
        ? body.watering_on
        : null;

    const { error: updateDeviceError } = await admin
      .from("devices")
      .update({
        last_seen: now,
        firmware_version:
          typeof body.firmware_version === "string"
            ? body.firmware_version.slice(0, 40)
            : null,
        updated_at: now,
      })
      .eq("id", device.id);

    if (updateDeviceError) throw updateDeviceError;

    const greenhouseUpdate: Record<string, unknown> = {
      last_seen: now,
      temperature,
      status,
    };

    // Nur den tatsächlichen Zustand der Bewässerung aktualisieren.
    // Dach- und Wandfenster bleiben unangetastet.
    if (reportedWateringOn !== null) {
      greenhouseUpdate.watering_on = reportedWateringOn;
    }

    const { data: greenhouse, error: greenhouseError } =
      await admin
        .from("greenhouses")
        .update(greenhouseUpdate)
        .eq("id", device.greenhouse_id)
        .select(
          [
            "id",
            "auto_mode",
            "roof_window_target",
            "wall_window_target",
            "watering_target",
            "roof_manual_override",
            "wall_manual_override",
            "watering_manual_override",
          ].join(","),
        )
        .single();

    if (greenhouseError) throw greenhouseError;

    const { error: sensorError } = await admin
      .from("sensor_readings")
      .insert({
        greenhouse_id: device.greenhouse_id,
        temperature,
        roof_window_open:
          typeof body.roof_window_open === "boolean"
            ? body.roof_window_open
            : null,
        wall_window_open:
          typeof body.wall_window_open === "boolean"
            ? body.wall_window_open
            : null,
        watering_on: reportedWateringOn,
        created_at: now,
      });

    if (sensorError) throw sensorError;

    let scheduleActive = false;

    // Nur bei ausgeschaltetem manuellen Override wird der
    // Bewässerungszeitplan geprüft.
    if (!greenhouse.watering_manual_override) {
      const { data: schedules, error: scheduleError } =
        await admin
          .from("watering_schedule")
          .select("id,start_time,duration_minutes,enabled")
          .eq("greenhouse_id", device.greenhouse_id)
          .eq("enabled", true);

      if (scheduleError) throw scheduleError;

      const currentMinutes =
        getCurrentMinutesInZurich(nowDate);

      scheduleActive = (schedules ?? []).some((schedule) =>
        isScheduleCurrentlyActive(
          String(schedule.start_time),
          Number(schedule.duration_minutes),
          currentMinutes,
        ),
      );
    }

    const frostProtectionActive =
      status === "frost_protection" ||
      (temperature !== null && temperature <= 0);

    let effectiveWateringTarget = false;

    if (frostProtectionActive) {
      // Frostschutz hat immer höchste Priorität.
      effectiveWateringTarget = false;
    } else if (greenhouse.watering_manual_override) {
      // Manuelle Steuerung:
      // Der Button Starten oder Stoppen entscheidet.
      effectiveWateringTarget =
        greenhouse.watering_target === true;
    } else {
      // Automatik:
      // Der aktive Zeitplan entscheidet.
      effectiveWateringTarget = scheduleActive;
    }

    return NextResponse.json({
      ok: true,
      server_time: now,
      greenhouse_id: device.greenhouse_id,

      // Diese Felder helfen später bei der Fehlersuche.
      watering: {
        mode: greenhouse.watering_manual_override
          ? "manual"
          : "schedule",
        schedule_active: scheduleActive,
        frost_protection: frostProtectionActive,
        effective_target: effectiveWateringTarget,
      },

      commands: {
        auto_mode: greenhouse.auto_mode,

        // Dach und Wand bleiben unverändert.
        roof_window_target:
          greenhouse.roof_window_target,
        wall_window_target:
          greenhouse.wall_window_target,

        // Der Waveshare erhält hier den fertig berechneten
        // Bewässerungsbefehl.
        watering_target: effectiveWateringTarget,

        roof_manual_override:
          greenhouse.roof_manual_override,
        wall_manual_override:
          greenhouse.wall_manual_override,
        watering_manual_override:
          greenhouse.watering_manual_override,
      },
    });
  } catch (error) {
    console.error("Heartbeat-Fehler:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unbekannter Gerätefehler",
      },
      { status: 500 },
    );
  }
}