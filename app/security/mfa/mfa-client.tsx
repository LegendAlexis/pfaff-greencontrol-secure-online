"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Factor = {
  id: string;
  friendly_name?: string;
  status?: string;
};

export default function MfaClient({ returnTo = "/dashboard" }: { returnTo?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [currentLevel, setCurrentLevel] = useState<string | null>(null);
  const [nextLevel, setNextLevel] = useState<string | null>(null);
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const verifiedFactors = factors.filter((factor) => factor.status === "verified");
  const needsSessionVerification = verifiedFactors.length > 0 && currentLevel !== "aal2";

  async function loadSecurityState() {
    const [{ data: factorData, error: factorError }, { data: assuranceData, error: assuranceError }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);

    if (factorError) setMessage(factorError.message);
    if (assuranceError) setMessage(assuranceError.message);

    setFactors((factorData?.totp ?? []) as Factor[]);
    setCurrentLevel(assuranceData?.currentLevel ?? null);
    setNextLevel(assuranceData?.nextLevel ?? null);
  }

  useEffect(() => {
    void loadSecurityState();
  }, []);

  async function startEnrollment() {
    setMessage("");
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Pfaff GreenControl",
    });
    if (error) return setMessage(error.message);
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
  }

  async function verifyEnrollment() {
    setBusy(true);
    setMessage("");
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setBusy(false);
      return setMessage(challengeError.message);
    }

    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error) {
      setBusy(false);
      return setMessage(error.message);
    }

    setQrCode("");
    setSecret("");
    setCode("");
    setFactorId("");
    setMessage("Authenticator wurde erfolgreich aktiviert und die Sitzung ist jetzt bestätigt.");
    await loadSecurityState();
    setBusy(false);
    router.refresh();
  }

  async function confirmCurrentSession() {
    const verifiedFactor = verifiedFactors[0];
    if (!verifiedFactor) return setMessage("Kein verifizierter Authenticator vorhanden.");
    if (code.length !== 6) return setMessage("Bitte gib den sechsstelligen Code ein.");

    setBusy(true);
    setMessage("");

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: verifiedFactor.id,
    });
    if (challengeError) {
      setBusy(false);
      return setMessage(challengeError.message);
    }

    const { error } = await supabase.auth.mfa.verify({
      factorId: verifiedFactor.id,
      challengeId: challenge.id,
      code,
    });
    if (error) {
      setBusy(false);
      return setMessage(error.message);
    }

    setCode("");
    setMessage("MFA erfolgreich bestätigt. Kritische Aktionen sind für diese Sitzung freigeschaltet.");
    await loadSecurityState();
    setBusy(false);
    router.refresh();
    router.push(returnTo);
  }

  async function removeFactor(id: string) {
    if (!confirm("Authenticator wirklich entfernen? Danach sind kritische Admin-Aktionen gesperrt, bis ein neuer Authenticator eingerichtet wurde.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setMessage(error ? error.message : "Authenticator wurde entfernt.");
    await loadSecurityState();
  }

  return (
    <div className="space-y-6">
      {message && <div className="rounded-xl border border-slate-300 bg-white p-4">{message}</div>}

      <section className={`rounded-2xl border p-5 ${currentLevel === "aal2" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Sicherheitsstatus der Sitzung</h2>
            <p className="mt-2 text-slate-600">
              Ein verifizierter Authenticator ist eingerichtet. Für Löschen, Secret-Wechsel und Benutzeränderungen muss zusätzlich die aktuelle Sitzung bestätigt sein.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${currentLevel === "aal2" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-700"}`}>
            {currentLevel === "aal2" ? "MFA-Sitzung aktiv" : "Bestätigung erforderlich"}
          </span>
        </div>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Aktuelle Stufe</dt><dd className="font-bold">{currentLevel ?? "unbekannt"}</dd></div>
          <div><dt className="text-slate-500">Mögliche Stufe</dt><dd className="font-bold">{nextLevel ?? "unbekannt"}</dd></div>
        </dl>
      </section>

      {needsSessionVerification && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-2xl font-bold">Kritische Aktion bestätigen</h2>
          <p className="mt-2 text-slate-700">
            Öffne deine Authenticator-App und gib den aktuellen sechsstelligen Code ein. Danach wirst du automatisch zur vorherigen Seite zurückgeleitet.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && code.length === 6 && !busy) void confirmCurrentSession();
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-stelliger Code"
              className="rounded-xl border border-slate-300 bg-slate-50 p-3"
            />
            <button
              type="button"
              onClick={confirmCurrentSession}
              disabled={code.length !== 6 || busy}
              className="rounded-xl bg-emerald-600 px-5 py-3 font-black disabled:opacity-40"
            >
              {busy ? "Wird geprüft …" : "MFA bestätigen"}
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-2xl font-bold">Aktive Authenticatoren</h2>
        {factors.length === 0 ? (
          <p className="mt-3 text-slate-600">Noch kein Authenticator für Pfaff GreenControl eingerichtet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {factors.map((factor) => (
              <div key={factor.id} className="flex items-center justify-between rounded-xl border border-slate-300 bg-slate-50 p-4">
                <div>
                  <p className="font-bold">{factor.friendly_name || "Authenticator"}</p>
                  <p className="text-sm text-slate-500">Status: {factor.status}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFactor(factor.id)}
                  className="rounded-xl border border-red-300 px-3 py-2 text-sm font-bold text-red-700"
                >
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {!qrCode && factors.length === 0 && (
        <button type="button" onClick={startEnrollment} className="rounded-xl bg-emerald-600 px-5 py-3 font-black hover:bg-emerald-500">
          Authenticator hinzufügen
        </button>
      )}

      {qrCode && (
        <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
          <h2 className="text-2xl font-bold">Authenticator verbinden</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-700">
            <li>Öffne deine Authenticator-App.</li>
            <li>Scanne den QR-Code.</li>
            <li>Gib den angezeigten sechsstelligen Code ein.</li>
          </ol>
          <div className="mt-5 w-fit rounded-xl bg-white p-4"><img src={qrCode} alt="MFA QR-Code" className="h-52 w-52" /></div>
          <details className="mt-4 text-sm text-slate-600"><summary>Manuellen Schlüssel anzeigen</summary><code className="mt-2 block break-all rounded-lg bg-emerald-50 p-3">{secret}</code></details>
          <div className="mt-5 flex flex-wrap gap-3">
            <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-stelliger Code" className="rounded-xl border border-slate-300 bg-slate-50 p-3" />
            <button type="button" onClick={verifyEnrollment} disabled={code.length !== 6 || busy} className="rounded-xl bg-emerald-600 px-5 py-3 font-black disabled:opacity-40">
              {busy ? "Wird geprüft …" : "Bestätigen"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
