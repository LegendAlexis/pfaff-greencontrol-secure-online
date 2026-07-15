import Nav from "../components/nav";
import { requireManager } from "../../lib/auth/permissions";
import { createAdminClient } from "../../lib/supabase/admin";

export default async function LogsPage() {
  await requireManager();
  const admin=createAdminClient();
  const {data:logs,error}=await admin.from("audit_logs").select("id,created_at,action,entity_type,entity_id,greenhouse_id,actor_user_id,metadata,profiles:actor_user_id(full_name,email)").order("created_at",{ascending:false}).limit(250);
  if(error) throw new Error(error.message);
  return <main className="min-h-screen bg-zinc-950 text-white"><Nav/><div className="mx-auto max-w-7xl p-5 md:p-8"><p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Nachvollziehbarkeit</p><h1 className="mt-2 text-4xl font-black">Ereignisprotokoll</h1><p className="mt-2 text-zinc-400">Sicherheitsrelevante Änderungen werden dauerhaft mit Zeit und Benutzer gespeichert.</p><div className="mt-7 overflow-x-auto rounded-2xl border border-zinc-800"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-zinc-900 text-zinc-400"><tr><th className="p-4">Zeit</th><th className="p-4">Benutzer</th><th className="p-4">Aktion</th><th className="p-4">Objekt</th><th className="p-4">Gewächshaus</th></tr></thead><tbody>{(logs??[]).map((log:any)=><tr key={log.id} className="border-t border-zinc-800 bg-zinc-950"><td className="p-4">{new Date(log.created_at).toLocaleString("de-CH")}</td><td className="p-4">{log.profiles?.full_name||log.profiles?.email||"System"}</td><td className="p-4 font-mono text-emerald-300">{log.action}</td><td className="p-4">{log.entity_type}{log.entity_id?` · ${log.entity_id}`:""}</td><td className="p-4">{log.greenhouse_id?`GH${String(log.greenhouse_id).padStart(2,"0")}`:"—"}</td></tr>)}</tbody></table></div></div></main>;
}
