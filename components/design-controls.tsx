"use client";
import { useState, useTransition, type MouseEvent } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { changeLocale } from "@/app/preferences";

export function DesignControls({ locale }: { locale: "th" | "en" }) {
  const { setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  function language(next: "th" | "en") {
    startTransition(async () => {
      try {
        const result = await changeLocale(next);
        setError(result.error);
        if (!result.error) { document.documentElement.lang = next; router.refresh(); }
      } catch { setError("Unable to save language. Please try again."); }
    });
  }
  function theme(event: MouseEvent<HTMLButtonElement>) {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    const apply = () => setTheme(next);
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) { apply(); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(apply);
    void transition.ready.then(() => document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, { duration: 620, easing: "cubic-bezier(.65,0,.35,1)", pseudoElement: "::view-transition-new(root)" })).catch(() => {});
  }
  return <div className="ft-controls">
    <div className="ft-language" role="group" aria-label="Language">
      {(["th", "en"] as const).map(l => <button key={l} type="button" aria-pressed={locale === l} disabled={pending} onClick={() => language(l)}>{l.toUpperCase()}</button>)}
    </div>
    <button className="ft-theme-switch" type="button" onClick={theme} aria-label={locale === "th" ? "สลับธีม" : "Toggle theme"}>
      <span className="ft-theme-label"><span className="ft-dark-only">{locale === "th" ? "มืด" : "Dark"}</span><span className="ft-light-only">{locale === "th" ? "สว่าง" : "Light"}</span></span>
      <span className="ft-switch-track"><span className="ft-switch-knob"><Moon className="ft-dark-only" size={14}/><Sun className="ft-light-only" size={14}/></span></span>
    </button>
    {error && <span className="ft-control-error" role="alert">{error}</span>}
  </div>;
}
