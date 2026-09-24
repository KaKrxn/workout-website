"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
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
  const nav = useRef<HTMLElement>(null);
  const wave = useRef<HTMLSpanElement>(null);
  const shape = useRef<SVGSVGElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const waveX = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const targetIndex = useRef<number | null>(null);
  const selected = useRef(active);

  const moveWave = useCallback((index: number, animate = true) => {
    const waveEl = wave.current;
    const shapeEl = shape.current;
    const tab = tabRefs.current[index];
    if (!waveEl || !shapeEl || !tab) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;

    const destination = tab.offsetLeft + tab.offsetWidth / 2 - waveEl.offsetWidth / 2;
    targetIndex.current = index;
    const origin = waveX.current;
    const draw = (x: number, stretch = 1, height = 1) => {
      waveX.current = x;
      waveEl.style.transform = `translateX(${x}px)`;
      shapeEl.style.transform = `scale(${stretch}, ${height})`;
    };

    waveEl.style.opacity = "1";
    if (!animate || origin === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(destination);
      return;
    }
    if (Math.abs(destination - origin) < 1) return;

    const distance = destination - origin;
    const amplitude = Math.min(Math.abs(distance) / 260, 0.65);
    const startedAt = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - startedAt) / 460, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const bulge = Math.sin(Math.PI * t);
      draw(origin + distance * eased, 1 + amplitude * bulge, 1 - 0.2 * bulge);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else {
        draw(destination);
        frame.current = null;
      }
    };
    frame.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const navEl = nav.current;
    const waveEl = wave.current;
    if (!navEl || !waveEl) return;
    const placeWave = () => {
      if (selected.current < 0) { waveEl.style.opacity = "0"; return; }
      moveWave(selected.current, false);
    };
    const observer = new ResizeObserver(placeWave);
    observer.observe(navEl);
    tabRefs.current.forEach(tab => { if (tab) observer.observe(tab); });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.addEventListener("change", placeWave);
    let mounted = true;
    void document.fonts.ready.then(() => { if (mounted) placeWave(); });
    return () => {
      mounted = false;
      observer.disconnect();
      reduced.removeEventListener("change", placeWave);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [moveWave]);
  useEffect(() => {
    selected.current = active;
    if (active < 0) {
      if (wave.current) wave.current.style.opacity = "0";
      targetIndex.current = null;
      return;
    }
    if (targetIndex.current !== active) moveWave(active);
  }, [active, moveWave]);
  useEffect(() => {
    function close(e: PointerEvent) { if (open && !menu.current?.contains(e.target as Node)) setOpen(false); }
    function escape(e: KeyboardEvent) { if (open && e.key === "Escape") { setOpen(false); trigger.current?.focus(); } }
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  const more = [["/history", "History", "ประวัติ"], ["/library", "Library", "คลังท่า"], ["/settings", "Settings", "ตั้งค่า"], ...(admin ? [["/admin", "Admin", "ผู้ดูแล"]] : [])];
  return <header className="ft-header">
    <Brand/>
    <nav ref={nav} className="ft-liquid-nav" aria-label="Main navigation">
      {tabs.map(([href, en, th], index) => <Link ref={element => { tabRefs.current[index] = element; }} key={href} href={href} onClick={() => { setOpen(false); moveWave(index); }} aria-current={pathname === href || pathname.startsWith(href + "/") ? "page" : undefined}>{locale === "th" ? th : en}</Link>)}
      <span ref={wave} className="ft-wave" aria-hidden="true"><svg ref={shape} viewBox="0 0 100 24" preserveAspectRatio="none"><path d="M0 24 C18 24 23 0 50 0 C77 0 82 24 100 24 Z"/></svg></span>
    </nav>
    <div className="ft-header-actions"><DesignControls locale={locale}/>
      <div ref={menu} className="ft-account">
        <button ref={trigger} className="ft-avatar" aria-label={locale === "th" ? "เมนูบัญชี" : "Account menu"} aria-haspopup="menu" aria-expanded={open} aria-controls="account-links" onClick={() => setOpen(value => !value)} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()); } }}><span className="sr-only">{initial}</span></button>
        <div className="ft-account-menu" id="account-links" role="menu" aria-hidden={!open} inert={!open} data-open={open} onKeyDown={event => {
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
          if (!items.length) return;
          event.preventDefault();
          const current = items.indexOf(document.activeElement as HTMLElement);
          const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          items[next].focus();
        }}>
          {more.map(([href, en, th], index) => <Link key={href} href={href} role="menuitem" style={{ "--item-delay": `${70 + index * 45}ms` } as CSSProperties} onClick={() => setOpen(false)} aria-current={pathname === href || pathname.startsWith(href + "/") ? "page" : undefined}>{locale === "th" ? th : en}</Link>)}
          <hr style={{ "--rule-delay": `${70 + more.length * 45}ms` } as CSSProperties}/><form action={signOut}><button type="submit" role="menuitem" style={{ "--item-delay": `${70 + (more.length + 1) * 45}ms` } as CSSProperties}>{locale === "th" ? "ออกจากระบบ" : "Log out"}</button></form>
        </div>
      </div>
    </div>
  </header>;
}
