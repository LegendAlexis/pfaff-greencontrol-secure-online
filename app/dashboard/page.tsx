import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import Nav from "../components/nav";

const OFFLINE_AFTER_MS = 90_000;

type DeviceState = {
  online: boolean;
  ageMs: number | null;
  label: string;
};

function getDeviceState(lastSeen?: string | null): DeviceState {
  if (!lastSeen) {
    return {
      online: false,
      ageMs: null,
      label: "Noch kein Signal",
    };
  }

  const timestamp = new Date(lastSeen).getTime();

  if (Number.isNaN(timestamp)) {
    return {
      online: false,
      ageMs: null,
      label: "Ungültiger Gerätestatus",
    };
  }

  const ageMs = Math.max(0, Date.now() - timestamp);
  const online = ageMs < OFFLINE_AFTER_MS;

  if (online) {
    return {
      online: true,
      ageMs,
      label: "Online",
    };
  }

  const minutes = Math.floor(ageMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const label =
    days > 0
      ? `Offline seit ${days} Tag${days === 1 ? "" : "en"}`
      : hours > 0
        ? `Offline seit ${hours} Std.`
        : `Offline seit ${Math.max(1, minutes)} Min.`;

  return {
    online: false,
    ageMs,
    label,
  };
}

function hasTemperature(greenhouse: any) {
  return (
    greenhouse.temperature !== null &&
    greenhouse.temperature !== undefined &&
    Number.isFinite(Number(greenhouse.temperature))
  );
}

function isTemperatureOutsideTarget(greenhouse: any) {
  if (!hasTemperature(greenhouse)) return false;

  const temperature = Number(greenhouse.temperature);
  const lowerLimit = Number(greenhouse.temperature_close);
  const upperLimit = Number(greenhouse.temperature_open);

  const hasLowerLimit = Number.isFinite(lowerLimit);
  const hasUpperLimit = Number.isFinite(upperLimit);

  if (!hasLowerLimit && !hasUpperLimit) return false;
  if (hasLowerLimit && temperature < lowerLimit) return true;
  if (hasUpperLimit && temperature > upperLimit) return true;

  return false;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships, error } = await supabase
    .from("greenhouse_users")
    .select("role, greenhouses(*)")
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  const greenhouses = (memberships ?? [])
    .map((membership: any) => ({
      ...membership.greenhouses,
      role: membership.role,
    }))
    .filter((greenhouse: any) => Boolean(greenhouse?.id));

  const onlineCount = greenhouses.filter(
    (greenhouse: any) => getDeviceState(greenhouse.last_seen).online,
  ).length;

  const wateringCount = greenhouses.filter(
    (greenhouse: any) =>
      greenhouse.watering_on === true ||
      greenhouse.watering_running === true ||
      greenhouse.watering_active === true,
  ).length;

  const temperatureWarningCount = greenhouses.filter((greenhouse: any) =>
    isTemperatureOutsideTarget(greenhouse),
  ).length;

  const warningCount = greenhouses.filter((greenhouse: any) => {
    const device = getDeviceState(greenhouse.last_seen);

    return (
      !device.online ||
      greenhouse.warning_active === true ||
      greenhouse.status === "frost_protection" ||
      isTemperatureOutsideTarget(greenhouse)
    );
  }).length;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Nav />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
              Betriebsübersicht
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Gewächshäuser
            </h1>

            <p className="mt-2 max-w-2xl text-zinc-400">
              Alle wichtigen Zustände auf einen Blick. Für Steuerung und
              Einstellungen einfach ein Gewächshaus auswählen.
            </p>
          </div>

          <div className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300">
            {onlineCount} von {greenhouses.length} online
          </div>
        </header>

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-400">
                Gewächshäuser
              </p>

              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-lg">
                ▦
              </span>
            </div>

            <p className="mt-4 text-3xl font-black">
              {greenhouses.length}
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              Ihrem Konto zugewiesen
            </p>
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-400">
                Online
              </p>

              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                ●
              </span>
            </div>

            <p className="mt-4 text-3xl font-black text-emerald-300">
              {onlineCount}
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              Geräte senden aktuelle Daten
            </p>
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-400">
                Bewässerung aktiv
              </p>

              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
                💧
              </span>
            </div>

            <p className="mt-4 text-3xl font-black text-sky-300">
              {wateringCount}
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              Ventile momentan geöffnet
            </p>
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-400">
                Warnungen
              </p>

              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  warningCount > 0
                    ? "bg-orange-500/15 text-orange-300"
                    : "bg-emerald-500/15 text-emerald-300"
                }`}
              >
                {warningCount > 0 ? "!" : "✓"}
              </span>
            </div>

            <p
              className={`mt-4 text-3xl font-black ${
                warningCount > 0
                  ? "text-orange-300"
                  : "text-emerald-300"
              }`}
            >
              {warningCount}
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              {temperatureWarningCount > 0
                ? `${temperatureWarningCount} Temperaturabweichung${
                    temperatureWarningCount === 1 ? "" : "en"
                  }`
                : "Keine Temperaturabweichung"}
            </p>
          </article>
        </section>

        {greenhouses.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-xl">
              ▦
            </div>

            <h2 className="mt-4 text-xl font-bold">
              Noch kein Gewächshaus zugewiesen
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-zinc-400">
              Nach dem ersten Login muss der Benutzer einmal einem Gewächshaus
              zugewiesen werden.
            </p>
          </section>
        ) : (
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  Anlagenübersicht
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Karte anklicken, um Steuerung und Details zu öffnen.
                </p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {greenhouses.map((greenhouse: any) => {
                const device = getDeviceState(greenhouse.last_seen);
                const online = device.online;
                const storedTemperature = hasTemperature(greenhouse);
                const temperatureOutsideTarget =
                  isTemperatureOutsideTarget(greenhouse);

                const wateringActive =
                  greenhouse.watering_on === true ||
                  greenhouse.watering_running === true ||
                  greenhouse.watering_active === true;

                const warning =
                  !online ||
                  greenhouse.warning_active === true ||
                  greenhouse.status === "frost_protection" ||
                  temperatureOutsideTarget;

                const statusColor = !online
                  ? "bg-red-500"
                  : warning
                    ? "bg-amber-400"
                    : "bg-emerald-500";

                const statusLabel = !online
                  ? "Gerät offline"
                  : warning
                    ? "Überprüfung nötig"
                    : "Alles normal";

                return (
                  <Link
                    key={greenhouse.id}
                    href={`/greenhouses/${greenhouse.id}`}
                    className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition duration-200 hover:-translate-y-1 hover:border-zinc-700 hover:bg-zinc-900/90 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-0 left-0 w-2 ${statusColor}`}
                    />

                    <div className="p-6 pl-8">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-500">
                            Gewächshaus {greenhouse.id}
                          </p>

                          <h3 className="mt-1 truncate text-xl font-bold">
                            {greenhouse.name ??
                              `Gewächshaus ${greenhouse.id}`}
                          </h3>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                            online
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-red-500/15 text-red-300"
                          }`}
                        >
                          {device.label}
                        </span>
                      </div>

                      <div className="mt-7">
                        <p
                          className={`text-5xl font-black tracking-tight ${
                            temperatureOutsideTarget
                              ? "text-amber-300"
                              : "text-white"
                          }`}
                        >
                          {online && storedTemperature
                            ? `${Number(greenhouse.temperature).toFixed(1)} °C`
                            : "—"}
                        </p>

                        {!online && storedTemperature && (
                          <p className="mt-2 text-sm text-zinc-500">
                            Letzter Messwert:{" "}
                            {Number(greenhouse.temperature).toFixed(1)} °C
                          </p>
                        )}

                        {online && !storedTemperature && (
                          <p className="mt-2 text-sm text-zinc-500">
                            Noch kein Temperaturwert vorhanden
                          </p>
                        )}
                      </div>

                      <div className="mt-7 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-zinc-950/70 p-3">
                          <p className="text-xs uppercase tracking-wide text-zinc-500">
                            Bewässerung
                          </p>

                          <p
                            className={`mt-1 text-sm font-bold ${
                              wateringActive
                                ? "text-sky-300"
                                : "text-zinc-300"
                            }`}
                          >
                            {wateringActive ? "Aktiv" : "Aus"}
                          </p>
                        </div>

                        <div className="rounded-xl bg-zinc-950/70 p-3">
                          <p className="text-xs uppercase tracking-wide text-zinc-500">
                            Betriebsart
                          </p>

                          <p className="mt-1 text-sm font-bold text-zinc-300">
                            {greenhouse.auto_mode
                              ? "Automatik"
                              : "Manuell"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${statusColor}`}
                          />

                          <span
                            className={`text-sm font-semibold ${
                              warning
                                ? "text-amber-300"
                                : "text-emerald-300"
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </div>

                        <span className="text-xl text-zinc-500 transition group-hover:translate-x-1 group-hover:text-emerald-300">
                          →
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}