import Nav from "../components/nav";
import { requireManager } from "../../lib/auth/permissions";
import { createAdminClient } from "../../lib/supabase/admin";
import { deleteDevice, registerDevice, rotateDeviceSecret, toggleDevice } from "./actions";
import { CopyDeviceIdButton, DeleteDeviceButton } from "./device-controls";

export default async function DevicesPage({ searchParams }: { searchParams: Promise<{ new_device?: string; secret?: string }> }) {
  const params = await searchParams;
  await requireManager();
  const admin = createAdminClient();
  const [{ data: devices, error: devicesError }, { data: greenhouses, error: greenhousesError }] = await Promise.all([
    admin.from("devices").select("id,name,greenhouse_id,active,last_seen,firmware_version,created_at").order("greenhouse_id"),
    admin.from("greenhouses").select("id,name").order("id"),
  ]);

  if (devicesError) throw new Error(devicesError.message);
  if (greenhousesError) throw new Error(greenhousesError.message);

  return <main className="min-h-screen bg-slate-50 text-slate-950"><Nav /><div className="mx-auto max-w-7xl p-5 md:p-8">
    <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Hardware-Sicherheit</p><h1 className="mt-2 text-4xl font-black">Geräteverwaltung</h1><p className="mt-2 text-slate-600">Jede Waveshare-Steuerung erhält eine eigene Identität und ein eigenes Secret.</p>

    {params.secret && <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-800"><h2 className="text-xl font-black">Geräte-Secret jetzt sicher speichern</h2><p className="mt-2 text-sm">Dieses Secret wird nur einmal angezeigt. Nicht per E-Mail senden und nicht in GitHub speichern.</p><code className="mt-4 block break-all rounded-xl bg-emerald-50 p-4">{params.secret}</code></section>}

    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-2xl font-bold">Neue Waveshare-Steuerung registrieren</h2><p className="mt-2 text-sm text-slate-600">Das System erstellt eine eindeutige Geräte-ID und ein einmalig angezeigtes Secret für die spätere Hardware-Verbindung.</p><form action={registerDevice} className="mt-5 grid gap-4 md:grid-cols-3"><input name="name" required placeholder="z. B. Waveshare GH01" className="rounded-xl border border-slate-300 bg-slate-50 p-3"/><select name="greenhouse_id" required className="rounded-xl border border-slate-300 bg-slate-50 p-3"><option value="">Gewächshaus auswählen</option>{(greenhouses??[]).map(g=><option key={g.id} value={g.id}>GH{String(g.id).padStart(2,"0")}</option>)}</select><button className="w-fit rounded-xl bg-emerald-600 px-5 py-3 font-black hover:bg-emerald-500">Gerät erstellen</button></form></section>

    <section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(devices??[]).map(device=>{const online=Boolean(device.last_seen)&&Date.now()-new Date(device.last_seen!).getTime()<300000;return <article key={device.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-slate-500">GH{String(device.greenhouse_id).padStart(2,"0")}</p><h2 className="text-xl font-bold">{device.name}</h2></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${device.active?(online?"bg-emerald-500/20 text-emerald-300":"bg-amber-500/20 text-amber-700"):"bg-red-500/20 text-red-700"}`}>{device.active?(online?"Online":"Kein Signal"):"Deaktiviert"}</span></div><dl className="mt-5 space-y-3 text-sm"><div className="grid gap-2 sm:grid-cols-[110px_1fr_auto] sm:items-center"><dt className="text-slate-500">Geräte-ID</dt><dd className="break-all font-mono text-xs sm:text-sm">{device.id}</dd><CopyDeviceIdButton deviceId={device.id}/></div><div className="flex justify-between"><dt className="text-slate-500">Firmware</dt><dd>{device.firmware_version||"—"}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Letztes Signal</dt><dd>{device.last_seen?new Date(device.last_seen).toLocaleString("de-CH"):"Noch nie"}</dd></div></dl><div className="mt-5 flex flex-wrap gap-2"><form action={rotateDeviceSecret}><input type="hidden" name="device_id" value={device.id}/><button className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold hover:bg-slate-100" title="Das alte Secret wird sofort ungültig">Secret erneuern</button></form><form action={toggleDevice}><input type="hidden" name="device_id" value={device.id}/><input type="hidden" name="active" value={String(!device.active)}/><button className={`rounded-xl border px-3 py-2 text-sm font-bold ${device.active?"border-red-300 text-red-700":"border-emerald-300 text-emerald-300"}`}>{device.active?"Deaktivieren":"Aktivieren"}</button></form><form action={deleteDevice}><input type="hidden" name="device_id" value={device.id}/><DeleteDeviceButton deviceId={device.id} deviceName={device.name}/></form></div></article>})}</section>
  </div></main>;
}
