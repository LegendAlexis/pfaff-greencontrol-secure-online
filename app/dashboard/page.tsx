import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import Nav from "../components/nav";

export const dynamic = "force-dynamic";

const OFFLINE_AFTER_MS = 90_000;

type Greenhouse = Record<string, any>;

function getDeviceState(lastSeen?: string | null) {
  if (!lastSeen) return { online: false, label: "Noch kein Signal" };

  const timestamp = new Date(lastSeen).getTime();
  if (Number.isNaN(timestamp)) return { online: false, label: "Ungültiger Status" };

  const ageMs = Math.max(0, Date.now() - timestamp);
  if (ageMs < OFFLINE_AFTER_MS) return { online: true, label: "Online" };

  const minutes = Math.floor(ageMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  return {
    online: false,
    label: days > 0
      ? `Offline seit ${days} Tag${days === 1 ? "" : "en"}`
      : hours > 0
        ? `Offline seit ${hours} Std.`
        : `Offline seit ${Math.max(1, minutes)} Min.`,
  };
}

function hasTemperature(gh: Greenhouse) {
  return gh.temperature !== null && gh.temperature !== undefined && Number.isFinite(Number(gh.temperature));
}

function isWatering(gh: Greenhouse) {
  return gh.watering_on === true || gh.watering_running === true || gh.watering_active === true;
}

function isTemperatureOutsideTarget(gh: Greenhouse) {
  if (!hasTemperature(gh)) return false;
  const value = Number(gh.temperature);
  const low = Number(gh.temperature_close ?? gh.temperature_min);
  const high = Number(gh.temperature_open ?? gh.temperature_max);
  return (Number.isFinite(low) && value < low) || (Number.isFinite(high) && value > high);
}

function GreenhouseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M8 20V9"/><path d="M12 20V9"/><path d="M16 20V9"/></svg>;
}
function WifiIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/></svg>;
}
function DropIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2S5.5 9.3 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 9.3 12 2 12 2Z"/></svg>;
}
function AlertIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>;
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
    .filter((gh: Greenhouse) => Boolean(gh?.id));

  const onlineCount = greenhouses.filter((gh: Greenhouse) => getDeviceState(gh.last_seen).online).length;
  const wateringCount = greenhouses.filter(isWatering).length;
  const warningCount = greenhouses.filter((gh: Greenhouse) => {
    const device = getDeviceState(gh.last_seen);
    return !device.online || gh.warning_active === true || gh.status === "frost_protection" || isTemperatureOutsideTarget(gh);
  }).length;

  return (
    <main className="gc-page">
      <Nav />

      <div className="gc-container">
        <header className="gc-page-header">
          <div>
            <p className="gc-eyebrow">Betriebsübersicht</p>
            <h1>Gewächshäuser</h1>
            <p>Alle wichtigen Zustände auf einen Blick. Wählen Sie ein Gewächshaus,<br className="gc-desktop-break" /> um Steuerung und Details zu öffnen.</p>
          </div>
          <div className="gc-online-pill"><span />{onlineCount} von {greenhouses.length} online</div>
        </header>

        <section className="gc-stats" aria-label="Betriebskennzahlen">
          <article className="gc-stat-card">
            <div className="gc-stat-icon green"><GreenhouseIcon /></div>
            <div><p>Gewächshäuser</p><strong>{greenhouses.length}</strong><small>Ihrem Konto zugewiesen</small></div>
          </article>
          <article className="gc-stat-card">
            <div className="gc-stat-icon green"><WifiIcon /></div>
            <div><p>Online</p><strong>{onlineCount}</strong><small>Geräte senden Daten</small></div>
          </article>
          <article className="gc-stat-card">
            <div className="gc-stat-icon blue"><DropIcon /></div>
            <div><p>Bewässerung aktiv</p><strong>{wateringCount}</strong><small>Ventile geöffnet</small></div>
          </article>
          <article className="gc-stat-card">
            <div className="gc-stat-icon orange"><AlertIcon /></div>
            <div><p>Warnungen</p><strong>{warningCount}</strong><small>Störungen oder Abweichungen</small></div>
          </article>
        </section>

        <section className="gc-overview">
          <div className="gc-overview-head">
            <div><h2>Anlagenübersicht</h2><p>Karte anklicken, um Steuerung und Details zu öffnen.</p></div>
            <div className="gc-overview-tools" aria-hidden="true">
              <div className="gc-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>Suchen...</span></div>
              <div className="gc-filter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16l-6 7v5l-4 2v-7Z"/></svg><span>Filtern</span><span>⌄</span></div>
            </div>
          </div>

          {greenhouses.length === 0 ? (
            <div className="gc-empty"><h3>Noch kein Gewächshaus zugewiesen</h3><p>Nach dem ersten Login muss der Benutzer einem Gewächshaus zugewiesen werden.</p></div>
          ) : (
            <div className="gc-greenhouse-grid">
              {greenhouses.map((gh: Greenhouse) => {
                const device = getDeviceState(gh.last_seen);
                const watering = isWatering(gh);
                const temperatureWarning = isTemperatureOutsideTarget(gh);
                const warning = device.online && (gh.warning_active === true || gh.status === "frost_protection" || temperatureWarning);
                const storedTemperature = hasTemperature(gh);
                const accent = !device.online ? "red" : warning ? "orange" : watering ? "blue" : "green";
                const statusLabel = !device.online ? "Gerät offline" : warning ? "Warnung" : "Online";
                const badgeLabel = !device.online ? device.label : temperatureWarning ? "Temperatur prüfen" : watering ? "Bewässerung aktiv" : "Alles normal";

                return (
                  <Link key={gh.id} href={`/greenhouses/${gh.id}`} className={`gc-greenhouse-card accent-${accent}`}>
                    <div className="gc-card-top"><div><small>Gewächshaus {gh.id}</small><h3>{gh.name ?? `GH${String(gh.id).padStart(2, "0")}`}</h3></div><span className={`gc-status-dot ${accent}`} /></div>
                    <div className="gc-temperature-row">
                      <strong className={warning ? "is-warning" : storedTemperature ? "" : "is-muted"}>{storedTemperature ? `${Number(gh.temperature).toFixed(1)} °C` : "— °C"}</strong>
                      <span className={`gc-badge ${accent}`}>{badgeLabel}</span>
                    </div>
                    <div className="gc-card-meta">
                      <div><small>Bewässerung</small><strong>{watering ? "Aktiv" : "Aus"}</strong></div>
                      <div><small>Betriebsart</small><strong>{gh.auto_mode ? "Automatik" : "Manuell"}</strong></div>
                    </div>
                    <div className="gc-card-footer"><span className={`gc-footer-status ${accent}`}><i />{statusLabel}</span><span className="gc-arrow">→</span></div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <footer className="gc-footer">© {new Date().getFullYear()} Pfaff GreenControl · Alle Rechte vorbehalten</footer>
      </div>
    </main>
  );
}