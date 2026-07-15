import { updatePassword } from "./actions";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-12 text-white">
      <div className="mx-auto max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl md:p-12">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-400">
          Pfaff GreenControl
        </p>
        <h1 className="mt-4 text-3xl font-black">Neues Passwort setzen</h1>
        <p className="mt-3 text-zinc-400">
          Verwende mindestens 10 Zeichen und speichere das Passwort sicher.
        </p>

        {params.error && (
          <p className="mt-5 rounded-xl bg-red-500/15 p-3 text-red-200">
            {params.error}
          </p>
        )}

        <form action={updatePassword} className="mt-7 space-y-4">
          <input
            name="password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            placeholder="Neues Passwort"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"
          />
          <input
            name="confirmation"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            placeholder="Passwort wiederholen"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"
          />
          <button className="w-full rounded-xl bg-emerald-600 p-3 font-bold hover:bg-emerald-500">
            Passwort speichern
          </button>
        </form>
      </div>
    </main>
  );
}
