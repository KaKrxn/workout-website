"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DesignControls } from "./design-controls";
import { signOut } from "@/app/(auth)/actions";

const tabs = [["/today", "Today", "วันนี้"], ["/schedule", "Schedule", "ตาราง"], ["/analytics", "Stats", "สถิติ"], ["/body", "Body", "ร่างกาย"]];
export function Brand({ href = "/today" }: { href?: string }) {
  return <Link href={href} className="ft-brand"><span aria-hidden="true"/><strong>FitTrack</strong></Link>;
}
export function AppHeader({ locale, admin, initial }: { locale: "th" | "en"; admin: boolean; initial: string }) {
  const pathname = usePathname();
  const active = tabs.findIndex(([href]) => pathname === href || pathname.startsWith(href + "/"));
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function close(e: PointerEvent) { if (!menu.current?.contains(e.target as Node)) setOpen(false); }
    function escape(e: KeyboardEvent) { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } }
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);
  const more = [["/history", "History", "ประวัติ"], ["/library", "Library", "คลังท่า"], ["/settings", "Settings", "ตั้งค่า"], ...(admin ? [["/admin", "Admin", "ผู้ดูแล"]] : [])];
  return <header className="ft-header">
    <Brand/>
    <nav className="ft-liquid-nav" aria-label="Main navigation" style={{ "--tab-index": Math.max(0, active) } as CSSProperties}>
      {tabs.map(([href, en, th]) => <Link key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined}>{locale === "th" ? th : en}</Link>)}
      <span className="ft-wave" style={{ opacity: active < 0 ? 0 : 1 }} aria-hidden="true"><svg viewBox="0 0 100 24" preserveAspectRatio="none"><path d="M0 24 C18 24 23 0 50 0 C77 0 82 24 100 24 Z"/></svg></span>
    </nav>
    <div className="ft-header-actions"><DesignControls locale={locale}/>
      <div ref={menu} className="ft-account">
        <button ref={trigger} className="ft-avatar" aria-label={locale === "th" ? "เมนูบัญชี" : "Account menu"} aria-expanded={open} aria-controls="account-links" onClick={() => setOpen(!open)}><span className="sr-only">{initial}</span></button>
        {open && <div className="ft-account-menu" id="account-links">
          {more.map(([href, en, th]) => <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={pathname.startsWith(href) ? "page" : undefined}>{locale === "th" ? th : en}</Link>)}
          <hr/><form action={signOut}><button type="submit">{locale === "th" ? "ออกจากระบบ" : "Log out"}</button></form>
        </div>}
      </div>
    </div>
  </header>;
}
