import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import Nav from "../../components/nav";
import { addSchedule, deleteSchedule, enableAutomatic, setAutoMode, toggleRoofWindow, toggleWallWindow, toggleWatering, updateGreenhouseSettings, updateSchedule } from "../../actions";


const OFFLINE_AFTER_MS = 90_000;

function getDeviceState(lastSeen?: string | null) {
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

function Button({ children, tone = "neutral", disabled = false }: { children: React.ReactNode; tone?: "green" | "red" | "blue" | "neutral"; disabled?: boolean }) {
  const styles = { green: "bg-emerald-600 hover:bg-emerald-500", red: "bg-red-700 hover:bg-red-600", blue: "bg-blue-600 hover:bg-blue-500", neutral: "bg-zinc-700 hover:bg-zinc-600" };
  return <button disabled={disabled} className={`rounded-xl px-4 py-3 font-bold ${styles[tone]} disabled:cursor-not-allowed disabled:opacity-40`}>{children}</button>;
}

export default async function GreenhousePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const greenhouseId = Number(id);
  if (!Number.isInteger(greenhouseId)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("greenhouse_users").select("role").eq("greenhouse_id", greenhouseId).eq("user_id", user.id).single();
  if (!membership) notFound();
  const [{ data: gh }, { data: schedules }, { data: warnings }] = await Promise.all([
    supabase.from("greenhouses").select("*").eq("id", greenhouseId).single(),
    supabase.from("watering_schedule").select("*").eq("greenhouse_id", greenhouseId).order("start_time"),
    supabase.from("warning_logs").select("*").eq("greenhouse_id", greenhouseId).order("created_at", { ascending: false }).limit(10),
  ]);
  if (!gh) notFound();
  const device = getDeviceState(gh.last_seen);
  const hasStoredTemperature = gh.temperature !== null && gh.temperature !== undefined;
  const freshTemperature = device.online && hasStoredTemperature ? Number(gh.temperature) : null;
  const frost = gh.status === "frost_protection" || (freshTemperature !== null && freshTemperature <= 0);
  const canWrite = membership.role !== "viewer";

  return <main className="min-h-screen bg-zinc-950 text-white"><Nav /><div className="mx-auto max-w-7xl p-5 md:p-8">
    <Link href="/dashboard" className="text-emerald-400">← Alle Gewächshäuser</Link>
    <header className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-sm uppercase tracking-widest text-zinc-500">Gewächshaus {gh.id} · {membership.role}</p><h1 className="mt-1 text-4xl font-black">{gh.name ?? `Gewächshaus ${gh.id}`}</h1><p className={`mt-2 font-bold ${device.online ? "text-emerald-300" : "text-red-300"}`}>{device.label}</p></div><div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-3"><p className="text-sm text-zinc-400">Aktuelle Temperatur</p><p className="text-3xl font-black">{freshTemperature === null ? "—" : `${freshTemperature.toFixed(1)} °C`}</p>{!device.online && hasStoredTemperature && <p className="mt-1 text-sm text-zinc-500">Letzter Messwert: {Number(gh.temperature).toFixed(1)} °C</p>}</div></header>
    {!device.online && <div className="mt-6 rounded-2xl border border-red-500 bg-red-950/60 p-5 text-red-100"><p className="font-black">⚠ ESP32 offline</p><p className="mt-1 text-sm">Keine aktuellen Sensordaten. Steuerbefehle werden gespeichert und beim nächsten Verbindungsaufbau übernommen.</p></div>}
    {frost && <div className="mt-6 rounded-2xl border border-blue-500 bg-blue-950/60 p-5 font-bold text-blue-100">❄ Frostschutz aktiv – Bewässerung ist gesperrt.</div>}
    {gh.warning_active && <div className="mt-6 rounded-2xl border border-red-500 bg-red-950/60 p-5 font-bold text-red-100">⚠ {gh.warning_message ?? "Warnung aktiv"}</div>}

    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-zinc-400">Gesamtautomatik</p><p className="text-2xl font-black">{gh.auto_mode ? "EIN" : "AUS"}</p></div>{canWrite && <div className="flex gap-2"><form action={setAutoMode.bind(null, greenhouseId, true)}><Button tone="green">Einschalten</Button></form><form action={setAutoMode.bind(null, greenhouseId, false)}><Button tone="red">Ausschalten</Button></form></div>}</div></section>

    <section className="mt-6 grid gap-5 lg:grid-cols-3">
      <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="text-2xl font-bold">Dachfenster</h2><p className="mt-3 text-zinc-400">Status</p><p className="text-2xl font-black">{gh.roof_window_open ? "Offen" : "Geschlossen"}</p><p className="mt-3 text-sm text-zinc-400">{gh.roof_manual_override ? "Manuelle Priorität" : "Automatik erlaubt"}</p><p className="mt-2 text-sm text-zinc-500">Öffnen {gh.roof_temperature_open}° · Schließen {gh.roof_temperature_close}°</p>{canWrite && <div className="mt-5 flex flex-wrap gap-2"><form action={toggleRoofWindow.bind(null, greenhouseId, true)}><Button tone="green">Öffnen</Button></form><form action={toggleRoofWindow.bind(null, greenhouseId, false)}><Button tone="red">Schließen</Button></form><form action={enableAutomatic.bind(null, greenhouseId, "roof")}><Button>Automatik</Button></form></div>}</article>
      <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="text-2xl font-bold">Fensterwand</h2><p className="mt-3 text-zinc-400">Status</p><p className="text-2xl font-black">{gh.wall_window_open ? "Offen" : "Geschlossen"}</p><p className="mt-3 text-sm text-zinc-400">{gh.wall_manual_override ? "Manuelle Priorität" : "Automatik erlaubt"}</p><p className="mt-2 text-sm text-zinc-500">Öffnen {gh.wall_temperature_open}° · Schließen {gh.wall_temperature_close}°</p>{canWrite && <div className="mt-5 flex flex-wrap gap-2"><form action={toggleWallWindow.bind(null, greenhouseId, true)}><Button tone="green">Öffnen</Button></form><form action={toggleWallWindow.bind(null, greenhouseId, false)}><Button tone="red">Schließen</Button></form><form action={enableAutomatic.bind(null, greenhouseId, "wall")}><Button>Automatik</Button></form></div>}</article>
      <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="text-2xl font-bold">Bewässerung</h2><p className="mt-3 text-zinc-400">Status</p><p className="text-2xl font-black">{gh.watering_on ? "Aktiv" : "Aus"}</p><p className="mt-3 text-sm text-zinc-400">{gh.watering_manual_override ? "Manuelle Priorität" : "Zeitplan erlaubt"}</p>{canWrite && <div className="mt-5 flex flex-wrap gap-2"><form action={toggleWatering.bind(null, greenhouseId, true)}><Button tone="blue" disabled={frost}>Starten</Button></form><form action={toggleWatering.bind(null, greenhouseId, false)}><Button tone="red">Stoppen</Button></form><form action={enableAutomatic.bind(null, greenhouseId, "watering")}><Button>Zeitplan</Button></form></div>}</article>
    </section>

    {canWrite && <form action={updateGreenhouseSettings.bind(null, greenhouseId)} className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="text-2xl font-bold">Automatik-Grenzwerte</h2><div className="mt-4 grid gap-4 md:grid-cols-4">{[["roof_temperature_open","Dach öffnen"],["roof_temperature_close","Dach schließen"],["wall_temperature_open","Wand öffnen"],["wall_temperature_close","Wand schließen"]].map(([name,label]) => <label key={name} className="text-sm text-zinc-400">{label}<input name={name} type="number" step="0.1" defaultValue={gh[name]} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white" /></label>)}</div><button className="mt-4 rounded-xl bg-white px-5 py-3 font-bold text-black">Speichern</button></form>}

    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex items-center justify-between"><h2 className="text-2xl font-bold">Bewässerungszeiten</h2>{canWrite && <form action={addSchedule.bind(null, greenhouseId)}><Button tone="green">+ Zeit</Button></form>}</div><div className="mt-4 space-y-3">{(schedules ?? []).map((s: any) => <div key={s.id} className="rounded-xl bg-zinc-800 p-4">{canWrite ? <><form action={updateSchedule.bind(null, greenhouseId)} className="grid gap-3 md:grid-cols-4"><input type="hidden" name="id" value={s.id}/><input name="start_time" type="time" defaultValue={s.start_time?.slice(0,5)} className="rounded-xl bg-zinc-950 p-3"/><input name="duration_minutes" type="number" defaultValue={s.duration_minutes} className="rounded-xl bg-zinc-950 p-3"/><label className="flex items-center gap-2"><input name="enabled" type="checkbox" defaultChecked={s.enabled}/> Aktiv</label><Button>Speichern</Button></form><form action={deleteSchedule.bind(null, greenhouseId)} className="mt-2"><input type="hidden" name="id" value={s.id}/><button className="text-sm font-bold text-red-300">Löschen</button></form></> : <p>{s.start_time?.slice(0,5)} · {s.duration_minutes} Min. · {s.enabled ? "Aktiv" : "Aus"}</p>}</div>)}{!schedules?.length && <p className="text-zinc-500">Noch keine Zeiten angelegt.</p>}</div></section>

    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="text-2xl font-bold">Letzte Warnungen</h2><div className="mt-4 space-y-3">{(warnings ?? []).map((w: any) => <div key={w.id} className="rounded-xl border border-zinc-700 bg-zinc-800 p-4"><p className="font-bold">{w.message}</p><p className="mt-1 text-sm text-zinc-400">{w.created_at ? new Date(w.created_at).toLocaleString("de-CH") : ""}</p></div>)}{!warnings?.length && <p className="text-zinc-500">Keine Warnungen.</p>}</div></section>
  </div></main>;
}
