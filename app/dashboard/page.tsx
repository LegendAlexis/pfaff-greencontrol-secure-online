import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import Nav from "../components/nav";

const OFFLINE_AFTER_MS = 90_000;

type DeviceState = {
  online: boolean;
  label: string;
};

function getDeviceState(lastSeen?: string | null): DeviceState {
  if (!lastSeen) return { online: false, label: "Noch kein Signal" };

  const ageMs = Math.max(0, Date.now() - new Date(lastSeen).getTime());
  if (ageMs < OFFLINE_AFTER_MS) return { online: true, label: "Online" };

  const minutes = Math.floor(ageMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const label = days > 0
    ? `Offline seit ${days} Tag${days === 1 ? "" : "en"}`
    : hours > 0
      ? `Offline seit ${hours} Std.`
      : `Offline seit ${Math.max(1, minutes)} Min.`;

  return { online: false, label };
}

function isTemperatureOutsideTarget(greenhouse: any) {
  if (greenhouse.temperature === null || greenhouse.temperature === undefined) return false;

  const temperature = Number(greenhouse.temperature);
  const lowerLimits = [greenhouse.roof_temperature_close, greenhouse.wall_temperature_close]
    .filter((value) => value !== null && value !== undefined)
    .map(Number);
  const upperLimits = [greenhouse.roof_temperature_open, greenhouse.wall_temperature_open]
    .filter((value) => value !== null && value !== undefined)
    .map(Number);

  const lower = lowerLimits.length ? Math.min(...lowerLimits) : null;
  const upper = upperLimits.length ? Math.max(...upperLimits) : null;

  return (lower !== null && temperature < lower) || (upper !== null && temperature > upper);
}

function getGreenhouseStatus(greenhouse: any) {
  const device = getDeviceState(greenhouse.last_seen);
  const frost = greenhouse.status === "frost_protection";
  const warning = Boolean(greenhouse.warning_active) || frost;

  if (!device.online || warning) {
    return {
      tone: "danger",
      stripe: "bg-red-500",
      badge: "bg-red-500/15 text-red-200 ring-red-500/30",
      label: !device.online ? "Offline" : "Störung",
      detail: !device.online ? device.label : greenhouse.warning_message ?? (frost ? "Frostschutz aktiv" : "Warnung aktiv"),
    };
  }

  if (isTemperatureOutsideTarget(greenhouse)) {
    return {
      tone: "warning",
      stripe: "bg-amber-400",
      badge: "bg-amber-400/15 text-amber-100 ring-amber-400/30",
      label: "Prüfen",
      detail: "Temperatur ausserhalb des Zielbereichs",
    };
  }

  return {
    tone: "ok",
    stripe: "bg-emerald-400",
    badge: "bg-emerald-400/15 text-emerald-100 ring-emerald-400/30",
    label: "Alles normal",
    detail: device.label,
  };
}

function MetricCard({ label, value, hint, valueClass = "text-white" }: { label: string; value: string | number; hint: string; valueClass?: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-sm shadow-black/10">
      <p className="text-sm font-medium text-zinc-400">{label}</p>
      <p className={`mt-2 text-3xl font-black tracking-tight ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </article>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships, error } = await supabase
    .from("greenhouse_users")
    .select("role, greenhouses(*)")
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  const greenhouses = (memberships ?? [])
    .map((membership: any) => ({ ...membership.greenhouses, role: membership.role }))
    .filter(Boolean);

  const onlineCount = greenhouses.filter((greenhouse: any) => getDeviceState(greenhouse.last_seen).online).length;
  const warningCount = greenhouses.filter((greenhouse: any) => getGreenhouseStatus(greenhouse).tone === "danger").length;
  const wateringCount = greenhouses.filter((greenhouse: any) => greenhouse.watering_on).length;
  const temperatureAlertCount = greenhouses.filter(isTemperatureOutsideTarget).length;

  return (
    <main className="min-h-screen bg-[#090b0a] text-white">
      <Nav />
      <div className="mx-auto max-w-7xl px-5 py-7 md:px-8 md:py-10">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-400">Betriebsübersicht</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Gewächshäuser</h1>
            <p className="mt-2 max-w-2xl text-zinc-400">Alle wichtigen Zustände auf einen Blick. Eine Karte öffnet direkt die Steuerung des Gewächshauses.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            Live-Übersicht
          </div>
        </header>

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Online" value={`${onlineCount} / ${greenhouses.length}`} hint="verbundene Gewächshäuser" valueClass="text-emerald-300" />
          <MetricCard label="Warnungen" value={warningCount} hint="offene Störungen oder Offline-Geräte" valueClass={warningCount ? "text-red-300" : "text-white"} />
          <MetricCard label="Bewässerung" value={wateringCount} hint="aktuell aktive Anlagen" valueClass={wateringCount ? "text-sky-300" : "text-white"} />
          <MetricCard label="Temperatur" value={temperatureAlertCount} hint="ausserhalb des Zielbereichs" valueClass={temperatureAlertCount ? "text-amber-300" : "text-white"} />
        </section>

        {greenhouses.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-8">
            <h2 className="text-2xl font-bold">Noch kein Gewächshaus zugewiesen</h2>
            <p className="mt-2 text-zinc-400">Nach dem ersten Login muss der Benutzer einmal einem Gewächshaus zugewiesen werden.</p>
          </section>
        ) : (
          <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Gewächshausübersicht">
            {greenhouses.map((greenhouse: any) => {
              const device = getDeviceState(greenhouse.last_seen);
              const status = getGreenhouseStatus(greenhouse);
              const hasTemperature = greenhouse.temperature !== null && greenhouse.temperature !== undefined;
              const freshTemperature = device.online && hasTemperature ? Number(greenhouse.temperature) : null;

              return (
                <Link
                  key={greenhouse.id}
                  href={`/greenhouses/${greenhouse.id}`}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[#121513] p-6 shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#151916] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  aria-label={`${greenhouse.name ?? `Gewächshaus ${greenhouse.id}`} öffnen`}
                >
                  <span className={`absolute inset-y-0 left-0 w-1.5 ${status.stripe}`} aria-hidden="true" />

                  <div className="flex items-start justify-between gap-4 pl-1">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Gewächshaus {greenhouse.id}</p>
                      <h2 className="mt-1 truncate text-2xl font-bold tracking-tight">{greenhouse.name ?? `Gewächshaus ${greenhouse.id}`}</h2>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ${status.badge}`}>{status.label}</span>
                  </div>

                  <div className="mt-7 pl-1">
                    <p className="text-sm text-zinc-500">Aktuelle Temperatur</p>
                    <div className="mt-1 flex items-end gap-2">
                      <p className="text-5xl font-black tracking-tight">{freshTemperature === null ? "—" : freshTemperature.toFixed(1)}</p>
                      {freshTemperature !== null && <p className="pb-1 text-xl font-bold text-zinc-400">°C</p>}
                    </div>
                    {!device.online && hasTemperature && (
                      <p className="mt-2 text-xs text-zinc-500">Letzter Messwert: {Number(greenhouse.temperature).toFixed(1)} °C</p>
                    )}
                  </div>

                  <dl className="mt-7 grid grid-cols-2 gap-3 pl-1 text-sm">
                    <div className="rounded-2xl bg-white/[0.035] px-4 py-3">
                      <dt className="text-zinc-500">Bewässerung</dt>
                      <dd className={`mt-1 font-bold ${greenhouse.watering_on ? "text-sky-300" : "text-zinc-200"}`}>{greenhouse.watering_on ? "Aktiv" : "Aus"}</dd>
                    </div>
                    <div className="rounded-2xl bg-white/[0.035] px-4 py-3">
                      <dt className="text-zinc-500">Betriebsart</dt>
                      <dd className={`mt-1 font-bold ${greenhouse.auto_mode ? "text-emerald-300" : "text-zinc-200"}`}>{greenhouse.auto_mode ? "Automatik" : "Manuell"}</dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/10 pt-4 pl-1">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-200">{status.detail}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">Details und Steuerung öffnen</p>
                    </div>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-xl text-zinc-300 transition group-hover:bg-emerald-400 group-hover:text-black" aria-hidden="true">→</span>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
