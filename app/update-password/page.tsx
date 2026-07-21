import { updatePassword } from "./actions";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="gc-auth-page">
      <div className="gc-auth-card" style={{ maxWidth: "50rem" }}>
        <section className="gc-auth-brand">
          <p className="gc-auth-kicker">Pfaff GreenControl</p>
          <h1>Konto sicher halten.</h1>
          <p>Lege ein neues, starkes Passwort fest. Verwende mindestens zehn Zeichen.</p>
        </section>
        <section className="gc-auth-form">
          <h2>Neues Passwort setzen</h2>
          {params.error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{params.error}</p>}
          <form action={updatePassword} className="mt-6 space-y-4">
            <input name="password" type="password" required minLength={10} autoComplete="new-password" placeholder="Neues Passwort" />
            <input name="confirmation" type="password" required minLength={10} autoComplete="new-password" placeholder="Passwort wiederholen" />
            <button className="gc-auth-primary">Passwort speichern</button>
          </form>
        </section>
      </div>
    </main>
  );
}
