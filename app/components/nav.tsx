import Link from "next/link";
import { logout } from "../auth-actions";
import { getCurrentIdentity } from "../../lib/auth/permissions";
import NavLinks from "./nav-links";

type NavIcon = "home" | "weather" | "chart" | "bell" | "users" | "device" | "log" | "shield";

export default async function Nav() {
  const { profile } = await getCurrentIdentity();

  const items: { label: string; href: string; icon: NavIcon }[] = [
    { label: "Dashboard", href: "/dashboard", icon: "home" },
    { label: "Wetterstation", href: "/weather", icon: "weather" },
    { label: "Diagramme", href: "/history", icon: "chart" },
    { label: "Warnungen", href: "/notifications", icon: "bell" },
  ];

  if (["admin", "owner"].includes(profile.system_role)) {
    items.push(
      { label: "Benutzer", href: "/users", icon: "users" },
      { label: "Geräte", href: "/devices", icon: "device" },
      { label: "Protokoll", href: "/logs", icon: "log" },
    );
  }

  items.push({ label: "Sicherheit", href: "/security/mfa", icon: "shield" });

  const initials = (profile.full_name || profile.email || "AP")
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join("") || "AP";

  return (
    <nav className="gc-nav">
      <div className="gc-nav-inner">
        <Link href="/dashboard" className="gc-brand" aria-label="Pfaff GreenControl Dashboard">
          <span className="gc-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 42" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 40V4" />
              <path d="M16 13C9 11 5 7 5 2c7 1 11 5 11 11Z" />
              <path d="M16 20c7-2 11-6 11-11-7 1-11 5-11 11Z" />
              <path d="M16 28C9 26 5 22 5 17c7 1 11 5 11 11Z" />
              <path d="M16 35c7-2 11-6 11-11-7 1-11 5-11 11Z" />
            </svg>
          </span>
          <span>
            <strong>Pfaff GreenControl</strong>
            <small>Gewächshaus Steuerung</small>
          </span>
        </Link>

        <NavLinks items={items} />

        <form action={logout} className="gc-account-wrap">
          <button type="submit" className="gc-account" title="Abmelden">
            <span>{initials}</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </form>
      </div>
    </nav>
  );
}
