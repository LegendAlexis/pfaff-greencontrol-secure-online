import Nav from "../../components/nav";
import { getCurrentIdentity } from "../../../lib/auth/permissions";
import MfaClient from "./mfa-client";

type SearchParams = {
  message?: string;
  returnTo?: string;
};

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { profile } = await getCurrentIdentity();

  const requestedReturnTo = params.returnTo ?? "";

  const returnTo =
    requestedReturnTo.startsWith("/") &&
    !requestedReturnTo.startsWith("//")
      ? requestedReturnTo
      : "/dashboard";

  const isManager =
    profile.system_role === "admin" ||
    profile.system_role === "owner";

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Nav />

      <div className="mx-auto max-w-4xl p-5 md:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">
          Kontosicherheit
        </p>

        <h1 className="mt-2 text-4xl font-black">
          Zwei-Faktor-Authentifizierung
        </h1>

        <p className="mt-3 max-w-2xl text-zinc-400">
          Jeder angemeldete Benutzer kann sein Konto mit einer
          Authenticator-App schützen. Die Zwei-Faktor-Authentifizierung
          verändert die Rolle und die Berechtigungen eines Benutzers nicht.
        </p>

        {isManager ? (
          <div className="mt-6 rounded-xl border border-amber-700 bg-amber-950/30 p-4 text-amber-100">
            <p className="font-bold">
              Zusätzlicher Schutz für kritische Aktionen
            </p>

            <p className="mt-1 text-sm text-amber-200">
              Administratoren und Besitzer müssen ihre aktuelle Sitzung mit
              einem Authenticator-Code bestätigen, bevor sie beispielsweise
              Geräte löschen, Secrets erneuern oder Benutzerrechte ändern.
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-emerald-800 bg-emerald-950/20 p-4 text-emerald-100">
            <p className="font-bold">
              Freiwilliger zusätzlicher Kontoschutz
            </p>

            <p className="mt-1 text-sm text-emerald-200">
              Du kannst einen Authenticator einrichten, erhältst dadurch aber
              keine zusätzlichen Steuerungs- oder Verwaltungsrechte.
            </p>
          </div>
        )}

        {params.message && (
          <div className="mt-6 rounded-xl border border-amber-700 bg-amber-950/30 p-4 text-amber-200">
            {params.message}
          </div>
        )}

        <section className="mt-7 rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Konto
              </p>
              <p className="mt-1 break-all font-semibold">
                {profile.email}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Rolle
              </p>
              <p className="mt-1 font-semibold">
                {profile.system_role}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                MFA-Regel
              </p>
              <p className="mt-1 font-semibold">
                {profile.mfa_required
                  ? "Für kritische Aktionen erforderlich"
                  : "Optional"}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <MfaClient returnTo={returnTo} />
        </section>
      </div>
    </main>
  );
}