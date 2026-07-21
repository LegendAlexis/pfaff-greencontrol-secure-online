import Nav from "../components/nav";
import { requireManager } from "../../lib/auth/permissions";
import { createAdminClient } from "../../lib/supabase/admin";
import { deleteDevice, registerDevice, rotateDeviceSecret, toggleDevice } from "./actions";
import { CopyDeviceIdButton, CopySecretButton, DeleteDeviceButton } from "./device-controls";

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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <Nav />
      <div className="mx-auto max-w-7xl p-5 md:p-8 gc-standard-page">
        <header className="gc-standard-header">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Hardware-Sicherheit</p>
          <h1 className="mt-2 text-4xl font-black">Geräteverwaltung</h1>
          <p className="mt-2 text-slate-600">Jede Waveshare-Steuerung erhält eine eigene Identität und ein eigenes Secret.</p>
        </header>

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 gc-register-device">
          <h2 className="text-2xl font-bold">Neue Waveshare-Steuerung registrieren</h2>
          <p className="mt-2 text-sm text-slate-600">Das System erstellt eine eindeutige Geräte-ID und ein einmalig angezeigtes Secret für die spätere Hardware-Verbindung.</p>
          <form action={registerDevice} className="mt-5 grid gap-4 md:grid-cols-3">
            <input name="name" required placeholder="z. B. Waveshare GH01" className="rounded-xl border border-slate-300 bg-slate-50 p-3" />
            <select name="greenhouse_id" required className="rounded-xl border border-slate-300 bg-slate-50 p-3">
              <option value="">Gewächshaus auswählen</option>
              {(greenhouses ?? []).map((g) => <option key={g.id} value={g.id}>{g.name ?? `GH${String(g.id).padStart(2, "0")}`}</option>)}
            </select>
            <button className="gc-primary-button">Gerät erstellen</button>
          </form>
        </section>

        <section className="mt-7 gc-device-grid">
          {(devices ?? []).map((device) => {
            const online = Boolean(device.last_seen) && Date.now() - new Date(device.last_seen!).getTime() < 300000;
            const showSecret = Boolean(params.secret && params.new_device === device.id);
            return (
              <article key={device.id} className={`gc-device-card ${showSecret ? "has-new-secret" : ""}`}>
                <div className="gc-device-card-head">
                  <div>
                    <p className="gc-device-greenhouse">GH{String(device.greenhouse_id).padStart(2, "0")}</p>
                    <h2>{device.name}</h2>
                  </div>
                  <span className={`gc-device-status ${device.active ? (online ? "online" : "offline") : "disabled"}`}>
                    {device.active ? (online ? "Online" : "Kein Signal") : "Deaktiviert"}
                  </span>
                </div>

                {showSecret && params.secret && (
                  <section className="gc-device-secret" aria-label={`Neues Secret für ${device.name}`}>
                    <div>
                      <strong>Neues Geräte-Secret</strong>
                      <p>Nur einmal sichtbar. Jetzt sicher speichern.</p>
                    </div>
                    <code>{params.secret}</code>
                    <CopySecretButton secret={params.secret} />
                  </section>
                )}

                <dl className="gc-device-details">
                  <div className="gc-device-id-row">
                    <dt>Geräte-ID</dt>
                    <dd><code>{device.id}</code></dd>
                    <CopyDeviceIdButton deviceId={device.id} />
                  </div>
                  <div><dt>Firmware</dt><dd>{device.firmware_version || "—"}</dd></div>
                  <div><dt>Letztes Signal</dt><dd>{device.last_seen ? new Date(device.last_seen).toLocaleString("de-CH") : "Noch nie"}</dd></div>
                </dl>

                <div className="gc-device-actions">
                  <form action={rotateDeviceSecret}>
                    <input type="hidden" name="device_id" value={device.id} />
                    <button className="gc-device-action" title="Das alte Secret wird sofort ungültig">Secret erneuern</button>
                  </form>
                  <form action={toggleDevice}>
                    <input type="hidden" name="device_id" value={device.id} />
                    <input type="hidden" name="active" value={String(!device.active)} />
                    <button className={`gc-device-action ${device.active ? "gc-device-action-warning" : "gc-device-action-positive"}`}>
                      {device.active ? "Deaktivieren" : "Aktivieren"}
                    </button>
                  </form>
                  <form action={deleteDevice}>
                    <input type="hidden" name="device_id" value={device.id} />
                    <DeleteDeviceButton deviceId={device.id} deviceName={device.name} />
                  </form>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
