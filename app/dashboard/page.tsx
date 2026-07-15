import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import Nav from "../components/nav";

const OFFLINE_AFTER_MS = 90_000;

function getDeviceState(lastSeen?: string | null) {
  if (!lastSeen) {
    return { online: false, ageMs: null as number | null, label: "Noch kein Signal" };
  }

  const ageMs = Math.max(0, Date.now() - new Date(lastSeen).getTime());
  const online = ageMs < OFFLINE_AFTER_MS;

  if (online) {
    return { online: true, ageMs, label: "Online" };
  }

  const minutes = Math.floor(ageMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const label = days > 0
    ? `Offline seit ${days} Tag${days === 1 ? "" : "en"}`
    : hours > 0
      ? `Offline seit ${hours} Std.`
      : `Offline seit ${Math.max(1, minutes)} Min.`;

  return { online: false, ageMs, label };
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

  const greenhouses = (memberships ?? []).map((m: any) => ({ ...m.greenhouses, role: m.role })).filter(Boolean);
  const onlineCount = greenhouses.filter((g: any) => getDeviceState(g.last_seen).online).length;
  const warningCount = greenhouses.filter((g: any) => {
    const device = getDeviceState(g.last_seen);
    return !device.online || g.warning_active || g.status === "frost_protection";
  }).length;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Nav />
      <div className="mx-auto max-w-7xl p-5 md:p-8">
        <header>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Betriebsübersicht</p>
          <h1 className="mt-2 text-4xl font-black">Gewächshäuser</h1>
          <p className="mt-2 text-zinc-400">Kompakte Übersicht – Details erst nach Auswahl.</p>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-zinc-400">Gewächshäuser</p><p className="mt-2 text-3xl font-black">{greenhouses.length}</p></div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-zinc-400">Online</p><p className="mt-2 text-3xl font-black text-emerald-300">{onlineCount}</p></div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-zinc-400">Warnungen</p><p className="mt-2 text-3xl font-black text-orange-300">{warningCount}</p></div>
        </section>

        {greenhouses.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
            <h2 className="text-2xl font-bold">Noch kein Gewächshaus zugewiesen</h2>
            <p className="mt-2 text-zinc-400">Nach dem ersten Login muss der Besitzer einmal in Supabase zugewiesen werden.</p>
          </section>
        ) : (
          <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {greenhouses.map((gh: any) => {
              const device = getDeviceState(gh.last_seen);
              const online = device.online;
              const warning = !online || gh.warning_active || gh.status === "frost_protection";
              const hasStoredTemperature = gh.temperature !== null && gh.temperature !== undefined;
              return (
                <Link key={gh.id} href={`/greenhouses/${gh.id}`} className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:-translate-y-1 hover:border-emerald-600">
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="text-sm text-zinc-500">Gewächshaus {gh.id}</p><h2 className="mt-1 text-2xl font-bold">{gh.name ?? `Gewächshaus ${gh.id}`}</h2></div>
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${online ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>{device.label}</span>
                  </div>
                  <p className="mt-8 text-5xl font-black">{online && hasStoredTemperature ? `${Number(gh.temperature).toFixed(1)}°` : "—"}</p>
                  {!online && hasStoredTemperature && (
                    <p className="mt-2 text-sm text-zinc-500">Letzter Messwert: {Number(gh.temperature).toFixed(1)} °C</p>
                  )}
                  <div className="mt-6 flex items-center justify-between text-sm"><span className="text-zinc-400">{gh.auto_mode ? "Automatik ein" : "Manueller Betrieb"}</span><span className={warning ? "font-bold text-orange-300" : "text-emerald-300"}>{!online ? "Gerät offline" : warning ? "Warnung" : "Alles normal"}</span></div>
                  <p className="mt-4 text-sm font-bold text-emerald-400 group-hover:text-emerald-300">Öffnen →</p>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
