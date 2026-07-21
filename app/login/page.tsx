import { login, requestPasswordReset } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return (
    <main className="gc-auth-page">
      <div className="gc-auth-card">
        <section className="gc-auth-brand">
          <p className="gc-auth-kicker">Pfaff GreenControl</p>
          <h1>Gewächshäuser sicher steuern.</h1>
          <p>Temperatur, Lüftung, Bewässerung, Wetterstation und Warnungen zentral und übersichtlich verwalten.</p>
        </section>
        <section className="gc-auth-form">
          <h2>Anmelden</h2>
          {params.error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{params.error}</p>}
          {params.message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-emerald-700">{params.message}</p>}
          <form action={login} className="mt-6 space-y-4">
            <input name="email" type="email" required autoComplete="email" placeholder="E-Mail" />
            <input name="password" type="password" required minLength={8} autoComplete="current-password" placeholder="Passwort" />
            <button className="gc-auth-primary">Anmelden</button>
          </form>
          <details className="gc-auth-details">
            <summary className="cursor-pointer font-bold">Passwort vergessen</summary>
            <form action={requestPasswordReset} className="mt-4 space-y-4">
              <input name="email" type="email" required autoComplete="email" placeholder="E-Mail" />
              <button className="gc-auth-primary">Reset-Link senden</button>
            </form>
          </details>
        </section>
      </div>
    </main>
  );
}
