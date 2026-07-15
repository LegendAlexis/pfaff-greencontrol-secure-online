import Nav from "../components/nav";
import { requireManager } from "../../lib/auth/permissions";
import { createAdminClient } from "../../lib/supabase/admin";

type AuditLog = {
  id: number;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  greenhouse_id: number | null;
  actor_user_id: string | null;
  metadata: Record<string, unknown> | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export default async function LogsPage() {
  await requireManager();
  const admin = createAdminClient();

  const { data: logs, error: logsError } = await admin
    .from("audit_logs")
    .select("id,created_at,action,entity_type,entity_id,greenhouse_id,actor_user_id,metadata")
    .order("created_at", { ascending: false })
    .limit(250);

  if (logsError) throw new Error(logsError.message);

  const actorIds = Array.from(
    new Set((logs ?? []).map((log) => log.actor_user_id).filter((id): id is string => Boolean(id)))
  );

  let profilesById = new Map<string, Profile>();
  if (actorIds.length > 0) {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id,full_name,email")
      .in("id", actorIds);

    if (profilesError) throw new Error(profilesError.message);
    profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile as Profile]));
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Nav />
      <div className="mx-auto max-w-7xl p-5 md:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Nachvollziehbarkeit</p>
        <h1 className="mt-2 text-4xl font-black">Ereignisprotokoll</h1>
        <p className="mt-2 text-zinc-400">Sicherheitsrelevante Änderungen werden dauerhaft mit Zeit und Benutzer gespeichert.</p>

        <div className="mt-7 overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="p-4">Zeit</th>
                <th className="p-4">Benutzer</th>
                <th className="p-4">Aktion</th>
                <th className="p-4">Objekt</th>
                <th className="p-4">Gewächshaus</th>
              </tr>
            </thead>
            <tbody>
              {(logs as AuditLog[] | null)?.length ? (
                (logs as AuditLog[]).map((log) => {
                  const profile = log.actor_user_id ? profilesById.get(log.actor_user_id) : null;
                  return (
                    <tr key={log.id} className="border-t border-zinc-800 bg-zinc-950">
                      <td className="p-4">{new Date(log.created_at).toLocaleString("de-CH")}</td>
                      <td className="p-4">{profile?.full_name || profile?.email || "System"}</td>
                      <td className="p-4 font-mono text-emerald-300">{log.action}</td>
                      <td className="p-4">{log.entity_type}{log.entity_id ? ` · ${log.entity_id}` : ""}</td>
                      <td className="p-4">{log.greenhouse_id ? `GH${String(log.greenhouse_id).padStart(2, "0")}` : "—"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr className="border-t border-zinc-800 bg-zinc-950">
                  <td colSpan={5} className="p-8 text-center text-zinc-500">Noch keine Ereignisse vorhanden.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
