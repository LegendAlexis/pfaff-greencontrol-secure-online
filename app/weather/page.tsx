import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import Nav from "../components/nav";

export default async function WeatherPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: weather } = await supabase.from("weather_station").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const online = weather?.last_seen && Date.now() - new Date(weather.last_seen).getTime() < 180_000;
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950"><Nav /><div className="mx-auto max-w-7xl p-5 md:p-8">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Eigene Wetterstation</p><h1 className="mt-2 text-4xl font-black">Wetter am Betrieb</h1><p className="mt-2 text-slate-600">Daten werden später direkt von der Wetterstation übernommen.</p>
      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-slate-600">Status</p><p className={`mt-2 text-2xl font-black ${online ? "text-emerald-300" : "text-red-700"}`}>{online ? "Online" : "Noch nicht verbunden"}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-slate-600">Außentemperatur</p><p className="mt-2 text-3xl font-black">{weather?.temperature == null ? "—" : `${Number(weather.temperature).toFixed(1)} °C`}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-slate-600">Wind</p><p className="mt-2 text-3xl font-black">{weather?.wind_speed == null ? "—" : `${weather.wind_speed} km/h`}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-slate-600">Regen</p><p className="mt-2 text-3xl font-black">{weather?.rain == null ? "—" : weather.rain ? "Ja" : "Nein"}</p></div>
      </section>
      <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6"><h2 className="text-xl font-bold">Vorbereitet für die professionelle Station</h2><p className="mt-2 text-slate-600">Geplant: Außentemperatur, Feuchtigkeit, Wind, Böen, Windrichtung, Regen, Luftdruck und Online-Status. Schutzregeln werden erst aktiviert, wenn die Station zuverlässig Daten liefert.</p></section>
    </div></main>
  );
}
