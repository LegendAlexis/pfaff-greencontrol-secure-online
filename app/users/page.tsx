import Nav from "../components/nav";
import { requireManager } from "../../lib/auth/permissions";
import { createAdminClient } from "../../lib/supabase/admin";
import { inviteUser, resendInvitation, revokeSessions, updateUserAccess } from "./actions";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const params = await searchParams;
  const { profile: actorProfile } = await requireManager();
  const admin = createAdminClient();

  const [{ data: listed }, { data: profiles }, { data: greenhouses }, { data: memberships }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    admin.from("profiles").select("id,full_name,email,system_role,is_active,mfa_required,created_at").order("created_at"),
    admin.from("greenhouses").select("id,name").order("id"),
    admin.from("greenhouse_users").select("user_id,greenhouse_id,role"),
  ]);

  const authById = new Map((listed?.users ?? []).map((u) => [u.id, u]));
  const membershipMap = new Map<string, number[]>();
  for (const membership of memberships ?? []) {
    const current = membershipMap.get(membership.user_id) ?? [];
    current.push(membership.greenhouse_id);
    membershipMap.set(membership.user_id, current);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <Nav />
      <div className="mx-auto max-w-7xl p-5 md:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Administration</p>
        <h1 className="mt-2 text-4xl font-black">Benutzerverwaltung</h1>
        <p className="mt-2 text-slate-600">Nur eingeladene Personen erhalten Zugang. Kritische Änderungen verlangen MFA.</p>

        {params.message && <div className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-700">{params.message}</div>}

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-2xl font-bold">Benutzer einladen</h2>
          <form action={inviteUser} className="mt-5 grid gap-4 md:grid-cols-2">
            <input name="full_name" required placeholder="Vor- und Nachname" className="rounded-xl border border-slate-300 bg-slate-50 p-3" />
            <input name="email" type="email" required placeholder="E-Mail-Adresse" className="rounded-xl border border-slate-300 bg-slate-50 p-3" />
            <label className="block text-sm font-bold text-slate-700">Rolle
              <select name="system_role" defaultValue="operator" className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3">
                {actorProfile.system_role === "admin" && <option value="admin">Administrator</option>}
                <option value="owner">Besitzer</option>
                <option value="operator">Mitarbeiter</option>
                <option value="viewer">Nur ansehen</option>
              </select>
            </label>
            <fieldset className="rounded-xl border border-slate-300 p-3 md:row-span-2">
              <legend className="px-2 text-sm font-bold">Gewächshäuser</legend>
              <div className="grid max-h-44 grid-cols-2 gap-2 overflow-auto p-1 sm:grid-cols-3">
                {(greenhouses ?? []).map((g) => <label key={g.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="greenhouse_ids" value={g.id} className="accent-emerald-500" />GH{String(g.id).padStart(2,"0")}</label>)}
              </div>
            </fieldset>
            <button className="w-fit rounded-xl bg-emerald-600 px-5 py-3 font-black hover:bg-emerald-500">Einladung senden</button>
          </form>
        </section>

        <section className="mt-7 space-y-4">
          {(profiles ?? []).map((profile) => {
            const authUser = authById.get(profile.id);
            const assigned = new Set(membershipMap.get(profile.id) ?? []);
            const confirmed = Boolean(authUser?.email_confirmed_at);
            return (
              <details key={profile.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h2 className="text-xl font-bold">{profile.full_name || profile.email}</h2><p className="text-sm text-slate-600">{profile.email}</p></div>
                    <div className="flex gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase">{profile.system_role}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${profile.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-700"}`}>{profile.is_active ? "Aktiv" : "Gesperrt"}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${confirmed ? "bg-blue-500/20 text-blue-300" : "bg-amber-500/20 text-amber-700"}`}>{confirmed ? "Bestätigt" : "Einladung offen"}</span></div>
                  </div>
                </summary>
                <form action={updateUserAccess} className="mt-5 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-2">
                  <input type="hidden" name="user_id" value={profile.id} />
                  <label className="text-sm font-bold text-slate-700">Name<input name="full_name" defaultValue={profile.full_name ?? ""} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3" /></label>
                  <label className="text-sm font-bold text-slate-700">Rolle<select name="system_role" defaultValue={profile.system_role} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3">{actorProfile.system_role === "admin" && <option value="admin">Administrator</option>}<option value="owner">Besitzer</option><option value="operator">Mitarbeiter</option><option value="viewer">Nur ansehen</option></select></label>
                  <fieldset className="rounded-xl border border-slate-300 p-3 md:col-span-2"><legend className="px-2 text-sm font-bold">Zugewiesene Gewächshäuser</legend><div className="grid max-h-52 grid-cols-2 gap-2 overflow-auto p-1 sm:grid-cols-5">{(greenhouses ?? []).map((g) => <label key={g.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="greenhouse_ids" value={g.id} defaultChecked={assigned.has(g.id)} className="accent-emerald-500" />GH{String(g.id).padStart(2,"0")}</label>)}</div></fieldset>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 p-4"><input name="is_active" type="checkbox" defaultChecked={profile.is_active} className="h-5 w-5 accent-emerald-500" /><span><b>Konto aktiv</b><br/><small className="text-slate-600">Ausgeschaltet verhindert neue Anmeldungen.</small></span></label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 p-4"><input name="mfa_required" type="checkbox" defaultChecked={profile.mfa_required} className="h-5 w-5 accent-emerald-500" /><span><b>MFA erforderlich</b><br/><small className="text-slate-600">Für Admin und Besitzer immer empfohlen.</small></span></label>
                  <button className="w-fit rounded-xl bg-emerald-600 px-5 py-3 font-black hover:bg-emerald-500">Zugriff speichern</button>
                </form>
                <div className="mt-4 flex flex-wrap gap-3">
                  {!confirmed && <form action={resendInvitation}><input type="hidden" name="email" value={profile.email ?? ""} /><button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-100">Einladung erneut senden</button></form>}
                  <form action={revokeSessions}><input type="hidden" name="user_id" value={profile.id} /><button className="rounded-xl border border-red-300 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50">Alle Sitzungen beenden</button></form>
                </div>
              </details>
            );
          })}
        </section>
      </div>
    </main>
  );
}
