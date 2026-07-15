import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import Nav from "../components/nav";

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="flex h-48 items-center justify-center text-zinc-500">Noch keine Verlaufsdaten</div>;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${90 - ((v - min) / range) * 75}`).join(" ");
  return <svg viewBox="0 0 100 100" className="h-48 w-full" preserveAspectRatio="none"><polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} className="text-emerald-400" /></svg>;
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: rows } = await supabase.from("sensor_readings").select("temperature,created_at,greenhouse_id").order("created_at", { ascending: true }).limit(96);
  const temps = (rows ?? []).map((r: any) => Number(r.temperature)).filter(Number.isFinite);
  return <main className="min-h-screen bg-zinc-950 text-white"><Nav /><div className="mx-auto max-w-7xl p-5 md:p-8"><p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Historie</p><h1 className="mt-2 text-4xl font-black">Diagramme</h1><p className="mt-2 text-zinc-400">Temperaturverlauf und später weitere Betriebsdaten.</p><section className="mt-7 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"><div className="flex items-end justify-between gap-4"><div><p className="text-zinc-400">Innenraumtemperatur</p><h2 className="text-2xl font-bold">Letzte Messungen</h2></div><span className="rounded-full bg-zinc-800 px-3 py-1 text-sm">24 Stunden</span></div><div className="mt-5"><Sparkline values={temps} /></div></section></div></main>;
}
