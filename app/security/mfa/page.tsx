import Nav from "../../components/nav";
import { getCurrentIdentity } from "../../../lib/auth/permissions";
import MfaClient from "./mfa-client";

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; returnTo?: string }>;
}) {
  const params = await searchParams;
  const { profile } = await getCurrentIdentity();
  const returnTo = params.returnTo?.startsWith("/") && !params.returnTo.startsWith("//")
    ? params.returnTo
    : "/dashboard";

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Nav />
      <div className="mx-auto max-w-4xl p-5 md:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Kontosicherheit</p>
        <h1 className="mt-2 text-4xl font-black">Zwei-Faktor-Authentifizierung</h1>
        <p className="mt-2 text-zinc-400">
          Für Administratoren und Besitzer schützt ein zusätzlicher Authenticator kritische Aktionen.
        </p>

        {params.message && (
          <div className="mt-6 rounded-xl border border-amber-700 bg-amber-950/30 p-4 text-amber-200">
            {params.message}
          </div>
        )}

        <div className="mt-7 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
          <b>Konto:</b> {profile.email}<br />
          <b>Rolle:</b> {profile.system_role}<br />
          <b>MFA-Vorgabe:</b> {profile.mfa_required ? "Erforderlich" : "Optional"}
        </div>

        <div className="mt-6">
          <MfaClient returnTo={returnTo} />
        </div>
      </div>
    </main>
  );
}
