"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

export default function MfaClient() {
  const supabase = createClient();
  const [factors, setFactors] = useState<any[]>([]);
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  async function loadFactors() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) setMessage(error.message);
    setFactors(data?.totp ?? []);
  }

  useEffect(() => { void loadFactors(); }, []);

  async function startEnrollment() {
    setMessage("");
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Pfaff GreenControl" });
    if (error) return setMessage(error.message);
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
  }

  async function verifyEnrollment() {
    setMessage("");
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) return setMessage(challengeError.message);
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error) return setMessage(error.message);
    setQrCode(""); setSecret(""); setCode(""); setFactorId("");
    setMessage("Authenticator wurde erfolgreich aktiviert.");
    await loadFactors();
  }

  async function removeFactor(id: string) {
    if (!confirm("Authenticator wirklich entfernen?")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setMessage(error ? error.message : "Authenticator wurde entfernt.");
    await loadFactors();
  }

  return <div className="space-y-6">
    {message && <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">{message}</div>}
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-2xl font-bold">Aktive Authenticatoren</h2>
      {factors.length===0?<p className="mt-3 text-zinc-400">Noch kein Authenticator für Pfaff GreenControl eingerichtet.</p>:<div className="mt-4 space-y-3">{factors.map(f=><div key={f.id} className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950 p-4"><div><p className="font-bold">{f.friendly_name||"Authenticator"}</p><p className="text-sm text-zinc-500">Status: {f.status}</p></div><button onClick={()=>removeFactor(f.id)} className="rounded-xl border border-red-800 px-3 py-2 text-sm font-bold text-red-300">Entfernen</button></div>)}</div>}
    </section>
    {!qrCode && <button onClick={startEnrollment} className="rounded-xl bg-emerald-600 px-5 py-3 font-black hover:bg-emerald-500">Authenticator hinzufügen</button>}
    {qrCode && <section className="rounded-2xl border border-emerald-700 bg-emerald-950/20 p-5"><h2 className="text-2xl font-bold">Authenticator verbinden</h2><ol className="mt-3 list-decimal space-y-2 pl-5 text-zinc-300"><li>Öffne deine Authenticator-App.</li><li>Scanne den QR-Code.</li><li>Gib den angezeigten sechsstelligen Code ein.</li></ol><div className="mt-5 w-fit rounded-xl bg-white p-4"><img src={qrCode} alt="MFA QR-Code" className="h-52 w-52" /></div><details className="mt-4 text-sm text-zinc-400"><summary>Manuellen Schlüssel anzeigen</summary><code className="mt-2 block break-all rounded-lg bg-black/30 p-3">{secret}</code></details><div className="mt-5 flex flex-wrap gap-3"><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" placeholder="6-stelliger Code" className="rounded-xl border border-zinc-700 bg-zinc-950 p-3"/><button onClick={verifyEnrollment} disabled={code.length!==6} className="rounded-xl bg-emerald-600 px-5 py-3 font-black disabled:opacity-40">Bestätigen</button></div></section>}
  </div>;
}
