"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: "home" | "weather" | "chart" | "bell" | "users" | "device" | "log" | "shield";
};

function Icon({ name }: { name: NavItem["icon"] }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "home": return <svg {...common}><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-7h6v7"/></svg>;
    case "weather": return <svg {...common}><path d="M12 2v2"/><path d="m4.93 4.93 1.42 1.42"/><path d="M2 12h2"/><path d="m4.93 19.07 1.42-1.42"/><path d="M12 20v2"/><path d="m19.07 19.07-1.42-1.42"/><path d="M20 12h2"/><path d="m19.07 4.93-1.42 1.42"/><circle cx="12" cy="12" r="4"/></svg>;
    case "chart": return <svg {...common}><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-7"/></svg>;
    case "bell": return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
    case "users": return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "device": return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 12h8"/><path d="M9 17h.01"/><path d="M15 17h.01"/></svg>;
    case "log": return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/></svg>;
    case "shield": return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>;
  }
}

export default function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="gc-mobile-menu" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Navigation öffnen">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
      <div className={`gc-nav-links ${open ? "is-open" : ""}`}>
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`gc-nav-link ${active ? "is-active" : ""}`}><Icon name={item.icon}/><span>{item.label}</span></Link>;
        })}
      </div>
    </>
  );
}
