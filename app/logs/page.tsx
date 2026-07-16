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

const ACTION_LABELS: Record<string, { label: string; tone: string; icon: string }> = {
  "device.registered": { label: "Gerät registriert", tone: "text-emerald-300 bg-emerald-500/10", icon: "＋" },
  "device.enabled": { label: "Gerät aktiviert", tone: "text-emerald-300 bg-emerald-500/10", icon: "✓" },
  "device.disabled": { label: "Gerät deaktiviert", tone: "text-amber-300 bg-amber-500/10", icon: "⏸" },
  "device.deleted": { label: "Gerät gelöscht", tone: "text-red-300 bg-red-500/10", icon: "×" },
  "device.secret_rotated": { label: "Geräte-Secret erneuert", tone: "text-sky-300 bg-sky-500/10", icon: "↻" },
  "user.invited": { label: "Benutzer eingeladen", tone: "text-emerald-300 bg-emerald-500/10", icon: "＋" },
  "user.access_updated": { label: "Benutzerrechte geändert", tone: "text-sky-300 bg-sky-500/10", icon: "✎" },
  "user.disabled": { label: "Benutzer gesperrt", tone: "text-red-300 bg-red-500/10", icon: "⊘" },
  "user.enabled": { label: "Benutzer aktiviert", tone: "text-emerald-300 bg-emerald-500/10", icon: "✓" },
  "user.sessions_revoked": { label: "Sitzungen beendet", tone: "text-amber-300 bg-amber-500/10", icon: "↪" },
};

function actionDisplay(action: string) {
  return ACTION_LABELS[action] ?? {
    label: action.replaceAll(".", " · "),
    tone: "text-zinc-300 bg-zinc-500/10",
    icon: "•",
  };
}

function objectLabel(log: AuditLog) {
  const name = typeof log.metadata?.name === "string" ? log.metadata.name : null;
  const typeLabels: Record<string, string> = {
    device: "Gerät",
    user: "Benutzer",
    greenhouse: "Gewächshaus",
    notification: "Warnmeldung",
  };
  const type = typeLabels[log.entity_type] ?? log.entity_type;
  return name ? `${type}: ${name}` : type;
}

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
                  const display = actionDisplay(log.action);
                  return (
                    <tr key={log.id} className="border-t border-zinc-800 bg-zinc-950 hover:bg-zinc-900/60">
                      <td className="p-4 whitespace-nowrap">{new Date(log.created_at).toLocaleString("de-CH")}</td>
                      <td className="p-4">{profile?.full_name || profile?.email || "System"}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-bold ${display.tone}`}>
                          <span aria-hidden>{display.icon}</span>{display.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold">{objectLabel(log)}</div>
                        {log.entity_id && <div className="mt-1 max-w-[260px] truncate font-mono text-xs text-zinc-500" title={log.entity_id}>{log.entity_id}</div>}
                      </td>
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
