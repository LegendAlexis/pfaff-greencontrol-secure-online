"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";
import { getMailFrom, getMailTransporter } from "../lib/mail";

async function authorizedClient(greenhouseId: number, write = true) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const { data, error } = await supabase
    .from("greenhouse_users")
    .select("role")
    .eq("greenhouse_id", greenhouseId)
    .eq("user_id", user.id)
    .single();

  if (error || !data) throw new Error("Keine Berechtigung");
  if (write && data.role === "viewer") throw new Error("Nur Lesezugriff");
  return supabase;
}

function refresh(greenhouseId: number) {
  revalidatePath("/dashboard");
  revalidatePath(`/greenhouses/${greenhouseId}`);
}

export async function setAutoMode(greenhouseId: number, enabled: boolean) {
  const supabase = await authorizedClient(greenhouseId);

  const values = enabled
    ? {
        auto_mode: true,
        roof_manual_override: false,
        wall_manual_override: false,
        watering_manual_override: false,
      }
    : { auto_mode: false };

  const { error } = await supabase
    .from("greenhouses")
    .update(values)
    .eq("id", greenhouseId);

  if (error) throw new Error(error.message);
  refresh(greenhouseId);
}

export async function toggleRoofWindow(greenhouseId: number, open: boolean) {
  const supabase = await authorizedClient(greenhouseId);
  const { error } = await supabase
    .from("greenhouses")
    .update({ roof_window_target: open, roof_manual_override: true })
    .eq("id", greenhouseId);
  if (error) throw new Error(error.message);
  refresh(greenhouseId);
}

export async function toggleWallWindow(greenhouseId: number, open: boolean) {
  const supabase = await authorizedClient(greenhouseId);
  const { error } = await supabase
    .from("greenhouses")
    .update({ wall_window_target: open, wall_manual_override: true })
    .eq("id", greenhouseId);
  if (error) throw new Error(error.message);
  refresh(greenhouseId);
}

export async function toggleWatering(greenhouseId: number, on: boolean) {
  const supabase = await authorizedClient(greenhouseId);
  const { data: gh, error: readError } = await supabase
    .from("greenhouses")
    .select("temperature,status")
    .eq("id", greenhouseId)
    .single();

  if (readError) throw new Error(readError.message);

  if (on && (gh?.status === "frost_protection" || (typeof gh?.temperature === "number" && gh.temperature <= 0))) {
    throw new Error("Frostschutz aktiv: Bewässerung bleibt gesperrt");
  }

  const { error } = await supabase
    .from("greenhouses")
    .update({ watering_target: on, watering_manual_override: true })
    .eq("id", greenhouseId);
  if (error) throw new Error(error.message);
  refresh(greenhouseId);
}

export async function enableAutomatic(greenhouseId: number, area: "roof" | "wall" | "watering") {
  const supabase = await authorizedClient(greenhouseId);
  const column = area === "roof" ? "roof_manual_override" : area === "wall" ? "wall_manual_override" : "watering_manual_override";
  const { error } = await supabase
    .from("greenhouses")
    .update({ [column]: false })
    .eq("id", greenhouseId);
  if (error) throw new Error(error.message);
  refresh(greenhouseId);
}

export async function updateGreenhouseSettings(greenhouseId: number, formData: FormData) {
  const supabase = await authorizedClient(greenhouseId);
  const roofOpen = Number(formData.get("roof_temperature_open"));
  const roofClose = Number(formData.get("roof_temperature_close"));
  const wallOpen = Number(formData.get("wall_temperature_open"));
  const wallClose = Number(formData.get("wall_temperature_close"));

  if (![roofOpen, roofClose, wallOpen, wallClose].every(Number.isFinite)) {
    throw new Error("Alle Temperaturwerte müssen gültige Zahlen sein");
  }
  if (!(roofOpen > roofClose && wallOpen > wallClose)) {
    throw new Error("Öffnungstemperatur muss über der Schließtemperatur liegen");
  }

  const { error } = await supabase
    .from("greenhouses")
    .update({
      roof_temperature_open: roofOpen,
      roof_temperature_close: roofClose,
      wall_temperature_open: wallOpen,
      wall_temperature_close: wallClose,
    })
    .eq("id", greenhouseId);
  if (error) throw new Error(error.message);
  refresh(greenhouseId);
}

export async function addSchedule(greenhouseId: number) {
  const supabase = await authorizedClient(greenhouseId);
  const { error } = await supabase
    .from("watering_schedule")
    .insert({ greenhouse_id: greenhouseId, start_time: "12:00", duration_minutes: 10, enabled: true });
  if (error) throw new Error(error.message);
  refresh(greenhouseId);
}

export async function updateSchedule(greenhouseId: number, formData: FormData) {
  const supabase = await authorizedClient(greenhouseId);
  const id = Number(formData.get("id"));
  const startTime = String(formData.get("start_time") ?? "");
  const durationMinutes = Number(formData.get("duration_minutes"));
  const enabled = formData.get("enabled") === "on";

  if (!Number.isInteger(id)) throw new Error("Ungültige Zeitplan-ID");
  if (!startTime) throw new Error("Startzeit fehlt");
  if (!Number.isFinite(durationMinutes) || durationMinutes < 1) throw new Error("Die Dauer muss mindestens eine Minute betragen");

  const { error } = await supabase
    .from("watering_schedule")
    .update({ start_time: startTime, duration_minutes: durationMinutes, enabled })
    .eq("id", id)
    .eq("greenhouse_id", greenhouseId);
  if (error) throw new Error(error.message);
  refresh(greenhouseId);
}

export async function deleteSchedule(greenhouseId: number, formData: FormData) {
  const supabase = await authorizedClient(greenhouseId);
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Ungültige Zeitplan-ID");

  const { error } = await supabase
    .from("watering_schedule")
    .delete()
    .eq("id", id)
    .eq("greenhouse_id", greenhouseId);
  if (error) throw new Error(error.message);
  refresh(greenhouseId);
}

export async function updateNotificationSettings(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const emailAddress = String(formData.get("email_address") ?? "").trim().toLowerCase();
  const emailEnabled = formData.get("email_enabled") === "on";
  if (emailEnabled && !emailAddress) throw new Error("Für E-Mail-Warnungen muss eine Empfängeradresse eingetragen sein");

  const { error } = await supabase
    .from("notification_settings")
    .upsert({
      user_id: user.id,
      email_address: emailAddress || user.email || null,
      email_enabled: emailEnabled,
      offline_alerts: formData.get("offline_alerts") === "on",
      frost_alerts: formData.get("frost_alerts") === "on",
      critical_alerts: formData.get("critical_alerts") === "on",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/notifications");
}

export async function sendTestWarningEmail() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: settings, error } = await supabase
    .from("notification_settings")
    .select("email_address,email_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) redirect(`/notifications?mail=error&message=${encodeURIComponent(error.message)}`);
  if (!settings?.email_enabled) redirect("/notifications?mail=disabled");

  const recipient = settings.email_address || user.email;
  if (!recipient) redirect("/notifications?mail=no-recipient");
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) redirect("/notifications?mail=not-configured");

  try {
    const transporter = getMailTransporter();
    await transporter.verify();
    await transporter.sendMail({
      from: getMailFrom(),
      to: recipient,
      subject: "Pfaff GreenControl – Testwarnung",
      text: [
        "Dies ist eine Testwarnung von Pfaff GreenControl.",
        "",
        "Der E-Mail-Versand wurde erfolgreich eingerichtet.",
        "Es liegt keine echte Störung vor.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px;background:#f4f7f5;color:#17201b">
          <div style="background:#123b2a;color:white;padding:20px;border-radius:14px 14px 0 0">
            <div style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;opacity:.8">Pfaff GreenControl</div>
            <h1 style="margin:8px 0 0;font-size:26px">Testwarnung</h1>
          </div>
          <div style="background:white;padding:24px;border-radius:0 0 14px 14px;border:1px solid #dfe8e2">
            <p style="font-size:17px;margin-top:0"><strong>Der E-Mail-Versand funktioniert.</strong></p>
            <p>Dies ist nur ein Test. Es liegt keine echte Störung im Gewächshaus vor.</p>
            <p style="color:#647067;font-size:13px;margin-bottom:0">Empfänger: ${recipient}</p>
          </div>
        </div>
      `,
    });
  } catch (mailError) {
    const message = mailError instanceof Error ? mailError.message : "Unbekannter Mailfehler";
    redirect(`/notifications?mail=error&message=${encodeURIComponent(message)}`);
  }

  redirect("/notifications?mail=sent");
}
