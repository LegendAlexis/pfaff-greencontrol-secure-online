import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import Nav from "../components/nav";
import { sendTestWarningEmail, updateNotificationSettings } from "../actions";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ mail?: string; message?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: settings } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const emailEnabled = settings?.email_enabled ?? false;


  const mailMessage = (() => {
    if (params.mail === "sent") return { ok: true, text: "Testmail wurde erfolgreich versendet." };
    if (params.mail === "disabled") return { ok: false, text: "Aktiviere zuerst die Warnmails und speichere die Einstellungen." };
    if (params.mail === "no-recipient") return { ok: false, text: "Es ist keine Empfängeradresse eingetragen." };
    if (params.mail === "not-configured") return { ok: false, text: "Gmail ist noch nicht in .env.local beziehungsweise Vercel eingerichtet." };
    if (params.mail === "error") return { ok: false, text: `Mailfehler: ${params.message ?? "Unbekannter Fehler"}` };
    return null;
  })();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <Nav />
      <div className="mx-auto max-w-4xl p-5 md:p-8">
        <header>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Benachrichtigungen</p>
          <h1 className="mt-2 text-4xl font-black">Warnmeldungen</h1>
          <p className="mt-2 text-slate-600">E-Mail-Warnungen können jederzeit zentral ein- oder ausgeschaltet werden.</p>
        </header>

        {mailMessage && (
          <div className={`mt-6 rounded-xl border p-4 font-bold ${mailMessage.ok ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-red-700 bg-red-950/30 text-red-700"}`}>
            {mailMessage.text}
          </div>
        )}

        <section className={`mt-7 rounded-2xl border p-5 ${emailEnabled ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-600">Aktueller Zustand</p>
              <p className={`mt-1 text-2xl font-black ${emailEnabled ? "text-emerald-300" : "text-slate-700"}`}>
                {emailEnabled ? "E-Mail-Warnungen EIN" : "E-Mail-Warnungen AUS"}
              </p>
            </div>
            <span className={`w-fit rounded-full px-4 py-2 text-sm font-black ${emailEnabled ? "bg-emerald-500/20 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
              {emailEnabled ? "Aktiv" : "Deaktiviert"}
            </span>
          </div>
        </section>

        <form action={updateNotificationSettings} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-2xl font-bold">E-Mail-Einstellungen</h2>

          <label className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-slate-300 bg-slate-50 p-4">
            <div>
              <p className="font-bold">Warnmails erlauben</p>
              <p className="mt-1 text-sm text-slate-600">Ausgeschaltet bedeutet: Es werden garantiert keine Warnmails versendet.</p>
            </div>
            <input
              name="email_enabled"
              type="checkbox"
              defaultChecked={emailEnabled}
              className="h-6 w-6 accent-emerald-500"
            />
          </label>

          <label className="mt-5 block text-sm font-bold text-slate-700">
            Empfängeradresse
            <input
              name="email_address"
              type="email"
              defaultValue={settings?.email_address ?? user.email ?? ""}
              placeholder="name@pfaff-biokraeuter.ch"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-950"
            />
          </label>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 p-4">
              <input name="offline_alerts" type="checkbox" defaultChecked={settings?.offline_alerts ?? true} className="h-5 w-5 accent-emerald-500" />
              <span><b>Gerät offline</b><br/><small className="text-slate-600">ESP32 oder Wetterstation</small></span>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 p-4">
              <input name="frost_alerts" type="checkbox" defaultChecked={settings?.frost_alerts ?? true} className="h-5 w-5 accent-emerald-500" />
              <span><b>Frostgefahr</b><br/><small className="text-slate-600">Wasser wird gesperrt</small></span>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 p-4">
              <input name="critical_alerts" type="checkbox" defaultChecked={settings?.critical_alerts ?? true} className="h-5 w-5 accent-emerald-500" />
              <span><b>Kritische Fehler</b><br/><small className="text-slate-600">Sensoren und Steuerung</small></span>
            </label>
          </div>

          <button className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 font-black hover:bg-emerald-500">
            Einstellungen speichern
          </button>
        </form>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-2xl font-bold">Gmail-Verbindung testen</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Der Test wird nur an die oben gespeicherte Empfängeradresse gesendet. Er löst keine echte Warnung aus.
          </p>
          <form action={sendTestWarningEmail}>
            <button
              className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-black hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!emailEnabled}
            >
              Testmail senden
            </button>
          </form>
          {!emailEnabled && (
            <p className="mt-3 text-sm text-amber-700">Aktiviere und speichere zuerst die Warnmails.</p>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
          <p className="font-black">Gmail ist verbunden</p>
          <p className="mt-2 text-sm leading-6 text-emerald-800/80">
            Testmails funktionieren. Automatische Warnungen werden nur für Gewächshäuser mit aktivierter Überwachung verschickt. Dieselbe Störung erzeugt genau eine Warnmail; nach Behebung folgt eine Entwarnung.
          </p>
        </section>
      </div>
    </main>
  );
}
