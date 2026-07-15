import { login, requestPasswordReset } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-12 text-white">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl md:grid-cols-2">
        <section className="bg-gradient-to-br from-emerald-950 to-zinc-950 p-8 md:p-12">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-400">Pfaff GreenControl</p>
          <h1 className="mt-5 text-4xl font-black">Gewächshäuser sicher steuern.</h1>
          <p className="mt-4 text-zinc-300">Temperatur, Lüftung, Bewässerung, Wetterstation und Warnungen in einem System.</p>
        </section>

        <section className="p-8 md:p-12">
          <h2 className="text-2xl font-bold">Anmelden</h2>
          {params.error && <p className="mt-4 rounded-xl bg-red-500/15 p-3 text-red-200">{params.error}</p>}
          {params.message && <p className="mt-4 rounded-xl bg-emerald-500/15 p-3 text-emerald-200">{params.message}</p>}

          <form action={login} className="mt-6 space-y-4">
            <input name="email" type="email" required placeholder="E-Mail" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3" />
            <input name="password" type="password" required minLength={8} placeholder="Passwort" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3" />
            <button className="w-full rounded-xl bg-emerald-600 p-3 font-bold hover:bg-emerald-500">Anmelden</button>
          </form>

          <details className="mt-6 rounded-xl border border-zinc-700 p-4">
            <summary className="cursor-pointer font-bold">Passwort vergessen</summary>
            <form action={requestPasswordReset} className="mt-4 space-y-4">
              <input name="email" type="email" required placeholder="E-Mail" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3" />
              <button className="w-full rounded-xl bg-zinc-700 p-3 font-bold hover:bg-zinc-600">Reset-Link senden</button>
            </form>
          </details>

        </section>
      </div>
    </main>
  );
}
