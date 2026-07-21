import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import Nav from "../../components/nav";
import {
  addSchedule,
  deleteSchedule,
  enableAutomatic,
  setAutoMode,
  toggleRoofWindow,
  toggleWallWindow,
  toggleWatering,
  updateGreenhouseSettings,
  updateSchedule,
} from "../../actions";

const OFFLINE_AFTER_MS = 90_000;

function getDeviceState(lastSeen?: string | null) {
  if (!lastSeen) return { online: false, label: "Noch kein Signal" };

  const timestamp = new Date(lastSeen).getTime();
  if (Number.isNaN(timestamp)) {
    return { online: false, label: "Ungültiger Status" };
  }

  const ageMs = Math.max(0, Date.now() - timestamp);
  if (ageMs < OFFLINE_AFTER_MS) return { online: true, label: "Online" };

  const minutes = Math.floor(ageMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const label =
    days > 0
      ? `Offline seit ${days} Tag${days === 1 ? "" : "en"}`
      : hours > 0
        ? `Offline seit ${hours} Std.`
        : `Offline seit ${Math.max(1, minutes)} Min.`;

  return { online: false, label };
}

type ButtonTone = "green" | "red" | "blue" | "neutral";

function Button({
  children,
  tone = "neutral",
  disabled = false,
  active = false,
}: {
  children: React.ReactNode;
  tone?: ButtonTone;
  disabled?: boolean;
  active?: boolean;
}) {
  const normalStyles: Record<ButtonTone, string> = {
    green:
      "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800",
    red: "bg-red-700 text-white hover:bg-red-800 active:bg-red-900",
    blue: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
    neutral:
      "bg-slate-200 text-slate-950 hover:bg-slate-300 active:bg-slate-400",
  };

  const activeStyles: Record<ButtonTone, string> = {
    green:
      "bg-emerald-900 text-white ring-2 ring-emerald-950 shadow-inner",
    red: "bg-red-950 text-white ring-2 ring-red-950 shadow-inner",
    blue: "bg-blue-900 text-white ring-2 ring-blue-950 shadow-inner",
    neutral:
      "bg-slate-600 text-white ring-2 ring-slate-700 shadow-inner",
  };

  return (
    <button
      type="submit"
      disabled={disabled}
      aria-pressed={active}
      className={[
        "rounded-xl px-4 py-3 font-bold",
        "transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-slate-700 focus-visible:ring-offset-2",
        "active:translate-y-px",
        "disabled:cursor-not-allowed disabled:bg-slate-300",
        "disabled:text-slate-600 disabled:opacity-100",
        active ? activeStyles[tone] : normalStyles[tone],
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default async function GreenhousePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const greenhouseId = Number(id);

  if (!Number.isInteger(greenhouseId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("greenhouse_users")
    .select("role")
    .eq("greenhouse_id", greenhouseId)
    .eq("user_id", user.id)
    .single();

  if (!membership) notFound();

  const [
    { data: gh, error: greenhouseError },
    { data: schedules, error: scheduleError },
    { data: warnings, error: warningError },
  ] = await Promise.all([
    supabase.from("greenhouses").select("*").eq("id", greenhouseId).single(),
    supabase
      .from("watering_schedule")
      .select("*")
      .eq("greenhouse_id", greenhouseId)
      .order("start_time"),
    supabase
      .from("warning_logs")
      .select("*")
      .eq("greenhouse_id", greenhouseId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (greenhouseError || !gh) notFound();
  if (scheduleError) throw new Error(scheduleError.message);
  if (warningError) throw new Error(warningError.message);

  const device = getDeviceState(gh.last_seen);
  const hasStoredTemperature =
    gh.temperature !== null && gh.temperature !== undefined;
  const freshTemperature =
    device.online && hasStoredTemperature ? Number(gh.temperature) : null;
  const frost =
    gh.status === "frost_protection" ||
    (freshTemperature !== null && freshTemperature <= 0);
  const canWrite = membership.role !== "viewer";

  const roofOpenSelected =
    gh.roof_manual_override === true && gh.roof_window_target === true;
  const roofCloseSelected =
    gh.roof_manual_override === true && gh.roof_window_target === false;
  const roofAutomaticSelected = gh.roof_manual_override !== true;

  const wallOpenSelected =
    gh.wall_manual_override === true && gh.wall_window_target === true;
  const wallCloseSelected =
    gh.wall_manual_override === true && gh.wall_window_target === false;
  const wallAutomaticSelected = gh.wall_manual_override !== true;

  const wateringStartSelected =
    gh.watering_manual_override === true && gh.watering_target === true;
  const wateringStopSelected =
    gh.watering_manual_override === true && gh.watering_target === false;
  const wateringAutomaticSelected = gh.watering_manual_override !== true;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <Nav />

      <div className="mx-auto max-w-7xl p-5 md:p-8">
        <Link href="/dashboard" className="font-semibold text-emerald-700">
          ← Alle Gewächshäuser
        </Link>

        <header className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-slate-500">
              Gewächshaus {gh.id} · {membership.role}
            </p>
            <h1 className="mt-1 text-4xl font-black">
              {gh.name ?? `Gewächshaus ${gh.id}`}
            </h1>
            <p
              className={`mt-2 font-bold ${
                device.online ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {device.label}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3">
            <p className="text-sm text-slate-600">Aktuelle Temperatur</p>
            <p className="text-3xl font-black">
              {freshTemperature === null
                ? "—"
                : `${freshTemperature.toFixed(1)} °C`}
            </p>
            {!device.online && hasStoredTemperature && (
              <p className="mt-1 text-sm text-slate-500">
                Letzter Messwert: {Number(gh.temperature).toFixed(1)} °C
              </p>
            )}
          </div>
        </header>

        {!device.online && (
          <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-5 text-red-800">
            <p className="font-black">⚠ ESP32 offline</p>
            <p className="mt-1 text-sm">
              Keine aktuellen Sensordaten. Steuerbefehle werden gespeichert und
              beim nächsten Verbindungsaufbau übernommen.
            </p>
          </div>
        )}

        {frost && (
          <div className="mt-6 rounded-2xl border border-blue-300 bg-blue-50 p-5 font-bold text-blue-800">
            ❄ Frostschutz aktiv – Bewässerung ist gesperrt.
          </div>
        )}

        {gh.warning_active && (
          <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-5 font-bold text-red-800">
            ⚠ {gh.warning_message ?? "Warnung aktiv"}
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-slate-600">Gesamtautomatik</p>
              <p className="text-2xl font-black">
                {gh.auto_mode ? "EIN" : "AUS"}
              </p>
            </div>

            {canWrite && (
              <div className="flex flex-wrap gap-2">
                <form action={setAutoMode.bind(null, greenhouseId, true)}>
                  <Button tone="green" active={gh.auto_mode === true}>
                    Einschalten
                  </Button>
                </form>

                <form action={setAutoMode.bind(null, greenhouseId, false)}>
                  <Button tone="red" active={gh.auto_mode !== true}>
                    Ausschalten
                  </Button>
                </form>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-2xl font-bold">Dachfenster</h2>
            <p className="mt-3 text-slate-600">Ist-Zustand</p>
            <p className="text-2xl font-black">
              {gh.roof_window_open ? "Offen" : "Geschlossen"}
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-700">
              Auswahl: {roofOpenSelected ? "Öffnen" : roofCloseSelected ? "Schliessen" : "Automatik"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Öffnen {gh.roof_temperature_open}° · Schliessen {gh.roof_temperature_close}°
            </p>
            {canWrite && (
              <div className="mt-5 flex flex-wrap gap-2">
                <form action={toggleRoofWindow.bind(null, greenhouseId, true)}>
                  <Button tone="green" active={roofOpenSelected}>Öffnen</Button>
                </form>
                <form action={toggleRoofWindow.bind(null, greenhouseId, false)}>
                  <Button tone="red" active={roofCloseSelected}>Schliessen</Button>
                </form>
                <form action={enableAutomatic.bind(null, greenhouseId, "roof")}>
                  <Button tone="neutral" active={roofAutomaticSelected}>Automatik</Button>
                </form>
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-2xl font-bold">Fensterwand</h2>
            <p className="mt-3 text-slate-600">Ist-Zustand</p>
            <p className="text-2xl font-black">
              {gh.wall_window_open ? "Offen" : "Geschlossen"}
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-700">
              Auswahl: {wallOpenSelected ? "Öffnen" : wallCloseSelected ? "Schliessen" : "Automatik"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Öffnen {gh.wall_temperature_open}° · Schliessen {gh.wall_temperature_close}°
            </p>
            {canWrite && (
              <div className="mt-5 flex flex-wrap gap-2">
                <form action={toggleWallWindow.bind(null, greenhouseId, true)}>
                  <Button tone="green" active={wallOpenSelected}>Öffnen</Button>
                </form>
                <form action={toggleWallWindow.bind(null, greenhouseId, false)}>
                  <Button tone="red" active={wallCloseSelected}>Schliessen</Button>
                </form>
                <form action={enableAutomatic.bind(null, greenhouseId, "wall")}>
                  <Button tone="neutral" active={wallAutomaticSelected}>Automatik</Button>
                </form>
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-2xl font-bold">Bewässerung</h2>
            <p className="mt-3 text-slate-600">Ist-Zustand</p>
            <p className="text-2xl font-black">
              {gh.watering_on ? "Aktiv" : "Aus"}
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-700">
              Auswahl: {wateringStartSelected ? "Starten" : wateringStopSelected ? "Stoppen" : "Zeitplan"}
            </p>
            {canWrite && (
              <div className="mt-5 flex flex-wrap gap-2">
                <form action={toggleWatering.bind(null, greenhouseId, true)}>
                  <Button tone="blue" disabled={frost} active={wateringStartSelected}>Starten</Button>
                </form>
                <form action={toggleWatering.bind(null, greenhouseId, false)}>
                  <Button tone="red" active={wateringStopSelected}>Stoppen</Button>
                </form>
                <form action={enableAutomatic.bind(null, greenhouseId, "watering")}>
                  <Button tone="neutral" active={wateringAutomaticSelected}>Zeitplan</Button>
                </form>
              </div>
            )}
          </article>
        </section>

        {canWrite && (
          <form action={updateGreenhouseSettings.bind(null, greenhouseId)} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-2xl font-bold">Automatik-Grenzwerte</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              {[
                ["roof_temperature_open", "Dach öffnen"],
                ["roof_temperature_close", "Dach schliessen"],
                ["wall_temperature_open", "Wand öffnen"],
                ["wall_temperature_close", "Wand schliessen"],
              ].map(([name, label]) => (
                <label key={name} className="text-sm text-slate-600">
                  {label}
                  <input name={name} type="number" step="0.1" required defaultValue={gh[name]} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-950" />
                </label>
              ))}
            </div>
            <button className="mt-4 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-700">Speichern</button>
          </form>
        )}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Bewässerungszeiten</h2>
            {canWrite && (
              <form action={addSchedule.bind(null, greenhouseId)}>
                <Button tone="green">+ Zeit</Button>
              </form>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {(schedules ?? []).map((schedule: any) => (
              <div key={schedule.id} className="rounded-xl bg-slate-100 p-4">
                {canWrite ? (
                  <>
                    <form action={updateSchedule.bind(null, greenhouseId)} className="grid gap-3 md:grid-cols-4">
                      <input type="hidden" name="id" value={schedule.id} />
                      <input name="start_time" type="time" required defaultValue={schedule.start_time?.slice(0, 5)} className="rounded-xl border border-slate-200 bg-white p-3" />
                      <input name="duration_minutes" type="number" min="1" required defaultValue={schedule.duration_minutes} className="rounded-xl border border-slate-200 bg-white p-3" />
                      <label className="flex items-center gap-2">
                        <input name="enabled" type="checkbox" defaultChecked={schedule.enabled} /> Aktiv
                      </label>
                      <Button>Speichern</Button>
                    </form>
                    <form action={deleteSchedule.bind(null, greenhouseId)} className="mt-2">
                      <input type="hidden" name="id" value={schedule.id} />
                      <button className="text-sm font-bold text-red-700 hover:text-red-900">Löschen</button>
                    </form>
                  </>
                ) : (
                  <p>{schedule.start_time?.slice(0, 5)} · {schedule.duration_minutes} Min. · {schedule.enabled ? "Aktiv" : "Aus"}</p>
                )}
              </div>
            ))}
            {!schedules?.length && <p className="text-slate-500">Noch keine Zeiten angelegt.</p>}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-2xl font-bold">Letzte Warnungen</h2>
          <div className="mt-4 space-y-3">
            {(warnings ?? []).map((warning: any) => (
              <div key={warning.id} className="rounded-xl border border-slate-300 bg-slate-100 p-4">
                <p className="font-bold">{warning.message}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {warning.created_at ? new Date(warning.created_at).toLocaleString("de-CH") : ""}
                </p>
              </div>
            ))}
            {!warnings?.length && <p className="text-slate-500">Keine Warnungen.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
