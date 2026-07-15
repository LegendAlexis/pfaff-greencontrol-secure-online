import Link from "next/link";
import { logout } from "../auth-actions";
import { getCurrentIdentity } from "../../lib/auth/permissions";

export default async function Nav() {
  const {profile}=await getCurrentIdentity();
  const items=[["Dashboard","/dashboard"],["Wetterstation","/weather"],["Diagramme","/history"],["Warnmails","/notifications"]];
  if(["admin","owner"].includes(profile.system_role)) items.push(["Benutzer","/users"],["Geräte","/devices"],["Protokoll","/logs"]);
  items.push(["Sicherheit","/security/mfa"]);
  return <nav className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4"><Link href="/dashboard" className="font-black tracking-tight text-emerald-400">Pfaff GreenControl</Link><div className="hidden gap-5 md:flex">{items.map(([label,href])=><Link key={href} href={href} className="text-sm font-semibold text-zinc-300 hover:text-white">{label}</Link>)}</div><form action={logout}><button className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-bold hover:bg-zinc-800">Abmelden</button></form></div><div className="flex gap-1 overflow-x-auto border-t border-zinc-800 px-2 py-2 md:hidden">{items.map(([label,href])=><Link key={href} href={href} className="shrink-0 rounded-lg px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800">{label}</Link>)}</div></nav>;
}
