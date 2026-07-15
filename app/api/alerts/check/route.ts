import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { escapeHtml, getMailFrom, getMailTransporter } from "../../../../lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OFFLINE_AFTER_MS = Number(process.env.ALERT_OFFLINE_AFTER_MINUTES || 5) * 60_000;

type AlertType = "offline" | "frost" | "critical";
type Greenhouse = {
  id: number;
  name: string | null;
  last_seen: string | null;
  temperature: number | null;
  status: string | null;
  warning_active: boolean | null;
  warning_message: string | null;
  monitoring_enabled: boolean | null;
};

type AlertCandidate = {
  type: AlertType;
  active: boolean;
  title: string;
  message: string;
  recommendation: string;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("Supabase Service Role ist nicht eingerichtet");
  return createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
}

function candidates(g: Greenhouse): AlertCandidate[] {
  const lastSeenMs = g.last_seen ? new Date(g.last_seen).getTime() : 0;
  const offline = !lastSeenMs || Date.now() - lastSeenMs > OFFLINE_AFTER_MS;
  const freshTemperature = !offline && typeof g.temperature === "number";
  const frost = freshTemperature && (g.temperature as number) <= 0;
  const criticalStatuses = new Set(["error", "sensor_error", "critical", "emergency_stop"]);
  const critical = Boolean(g.warning_active) || criticalStatuses.has((g.status || "").toLowerCase());

  return [
    {
      type: "offline",
      active: offline,
      title: `${g.name || `Gewächshaus ${g.id}`} ist offline`,
      message: g.last_seen
        ? `Das letzte Gerätesignal wurde am ${new Date(g.last_seen).toLocaleString("de-CH")} empfangen.`
        : "Von diesem Gewächshaus wurde noch kein Gerätesignal empfangen.",
      recommendation: "Bitte Stromversorgung, Netzwerk und Waveshare-Steuerung prüfen.",
    },
    {
      type: "frost",
      active: frost,
      title: `Frostgefahr in ${g.name || `Gewächshaus ${g.id}`}`,
      message: frost ? `Die aktuelle Temperatur beträgt ${g.temperature?.toFixed(1)} °C. Die Bewässerung muss gesperrt bleiben.` : "Frostgefahr beendet.",
      recommendation: "Heizung und Leitungen kontrollieren. Bewässerung nicht manuell erzwingen.",
    },
    {
      type: "critical",
      active: critical,
      title: `Kritische Störung in ${g.name || `Gewächshaus ${g.id}`}`,
      message: g.warning_message || `Status der Steuerung: ${g.status || "unbekannt"}.`,
      recommendation: "Steuerung, Sensoren und Relais prüfen. Bei Unsicherheit Anlage sicher abschalten.",
    },
  ];
}

async function sendAlertEmail(args: {
  to: string;
  greenhouse: Greenhouse;
  alert: AlertCandidate;
  resolved: boolean;
}) {
  const { to, greenhouse, alert, resolved } = args;
  const subject = resolved
    ? `Pfaff GreenControl – Entwarnung: ${alert.title}`
    : `Pfaff GreenControl – ${alert.type === "critical" ? "KRITISCH" : "Warnung"}: ${alert.title}`;
  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const accent = resolved ? "#047857" : alert.type === "critical" ? "#b91c1c" : "#b45309";
  const heading = resolved ? "Entwarnung" : alert.type === "critical" ? "Kritische Warnung" : "Warnmeldung";

  const transporter = getMailTransporter();
  const info = await transporter.sendMail({
    from: getMailFrom(),
    to,
    subject,
    text: [
      `Pfaff GreenControl – ${heading}`,
      `Gewächshaus: ${greenhouse.name || greenhouse.id}`,
      resolved ? "Der zuvor gemeldete Zustand ist nicht mehr aktiv." : alert.message,
      resolved ? "" : `Empfehlung: ${alert.recommendation}`,
      `Zeit: ${new Date().toLocaleString("de-CH")}`,
      `${dashboardUrl}/greenhouses/${greenhouse.id}`,
    ].filter(Boolean).join("\n\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px;background:#f4f7f5;color:#17201b">
        <div style="background:${accent};color:white;padding:22px;border-radius:14px 14px 0 0">
          <div style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;opacity:.85">Pfaff GreenControl</div>
          <h1 style="margin:8px 0 0;font-size:27px">${heading}</h1>
        </div>
        <div style="background:white;padding:24px;border-radius:0 0 14px 14px;border:1px solid #dfe8e2">
          <p style="font-size:18px;margin-top:0"><strong>${escapeHtml(alert.title)}</strong></p>
          <p><strong>Gewächshaus:</strong> ${escapeHtml(greenhouse.name || String(greenhouse.id))}</p>
          <p>${resolved ? "Der zuvor gemeldete Zustand ist nicht mehr aktiv." : escapeHtml(alert.message)}</p>
          ${resolved ? "" : `<div style="padding:14px;background:#f5f5f4;border-radius:10px"><strong>Empfehlung</strong><br>${escapeHtml(alert.recommendation)}</div>`}
          <p style="color:#647067;font-size:13px">Zeit: ${new Date().toLocaleString("de-CH")}</p>
          <a href="${dashboardUrl}/greenhouses/${greenhouse.id}" style="display:inline-block;margin-top:8px;padding:12px 18px;background:#059669;color:white;text-decoration:none;border-radius:9px;font-weight:bold">Dashboard öffnen</a>
        </div>
      </div>`,
  });
  return info.messageId;
}

export async function POST(request: NextRequest) {
  const expected = process.env.ALERT_CRON_SECRET;
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || received !== expected) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    const supabase = adminClient();
    const { data: greenhouses, error: greenhouseError } = await supabase
      .from("greenhouses")
      .select("id,name,last_seen,temperature,status,warning_active,warning_message,monitoring_enabled")
      .eq("monitoring_enabled", true);
    if (greenhouseError) throw greenhouseError;

    const { data: recipients, error: settingsError } = await supabase
      .from("notification_settings")
      .select("user_id,email_address,email_enabled,offline_alerts,frost_alerts,critical_alerts")
      .eq("email_enabled", true);
    if (settingsError) throw settingsError;

    let transitions = 0;
    let sent = 0;

    for (const greenhouse of (greenhouses || []) as Greenhouse[]) {
      for (const alert of candidates(greenhouse)) {
        const { data: previous, error: stateReadError } = await supabase
          .from("alert_states")
          .select("active")
          .eq("source_type", "greenhouse")
          .eq("source_id", greenhouse.id)
          .eq("alert_type", alert.type)
          .maybeSingle();
        if (stateReadError) throw stateReadError;

        const wasActive = previous?.active ?? false;
        if (wasActive === alert.active) continue;
        transitions += 1;

        const now = new Date().toISOString();
        const { error: stateWriteError } = await supabase.from("alert_states").upsert({
          source_type: "greenhouse",
          source_id: greenhouse.id,
          alert_type: alert.type,
          active: alert.active,
          activated_at: alert.active ? now : null,
          resolved_at: alert.active ? null : now,
          details: { title: alert.title, message: alert.message },
          updated_at: now,
        }, { onConflict: "source_type,source_id,alert_type" });
        if (stateWriteError) throw stateWriteError;

        for (const recipient of recipients || []) {
          const allowed = alert.type === "offline"
            ? recipient.offline_alerts
            : alert.type === "frost"
              ? recipient.frost_alerts
              : recipient.critical_alerts;
          if (!allowed || !recipient.email_address) continue;

          try {
            const messageId = await sendAlertEmail({
              to: recipient.email_address,
              greenhouse,
              alert,
              resolved: !alert.active,
            });
            sent += 1;
            await supabase.from("email_notification_log").insert({
              user_id: recipient.user_id,
              greenhouse_id: greenhouse.id,
              warning_key: `${alert.type}:${alert.active ? "active" : "resolved"}`,
              subject: alert.title,
              status: "sent",
              provider_message_id: messageId,
              sent_at: new Date().toISOString(),
            });
          } catch (error) {
            await supabase.from("email_notification_log").insert({
              user_id: recipient.user_id,
              greenhouse_id: greenhouse.id,
              warning_key: `${alert.type}:${alert.active ? "active" : "resolved"}`,
              subject: alert.title,
              status: "failed",
              error_message: error instanceof Error ? error.message : "Unbekannter Mailfehler",
            });
          }
        }
      }
    }

    return NextResponse.json({ ok: true, checked: greenhouses?.length || 0, transitions, sent });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }, { status: 500 });
  }
}
