"use client";
import { useEffect, useRef, useState, useTransition, type MouseEvent } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { changeLocale } from "@/app/preferences";

export function DesignControls({ locale }: { locale: "th" | "en" }) {
  const { setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimisticLocale, setOptimisticLocale] = useState<{ source: "th" | "en"; value: "th" | "en" } | null>(null);
  const displayLocale = optimisticLocale?.source === locale ? optimisticLocale.value : locale;
  const [flipping, setFlipping] = useState(false);
  const languageBlob = useRef<HTMLSpanElement>(null);
  const flipTimers = useRef<number[]>([]);
  const router = useRouter();
  useEffect(() => () => flipTimers.current.forEach(window.clearTimeout), []);
  function language(next: "th" | "en") {
    if (next === displayLocale) return;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      languageBlob.current?.animate([
        { transform: "scale(1,1)" },
        { transform: "scale(1.4,.95)", offset: .45 },
        { transform: "scale(1,1)" },
      ], { duration: 520, easing: "cubic-bezier(.3,.7,.3,1)" });
    }
    setOptimisticLocale({ source: locale, value: next });
    startTransition(async () => {
      try {
        const result = await changeLocale(next);
        setError(result.error);
        if (result.error) { setOptimisticLocale(null); return; }
        document.documentElement.lang = next;
        router.refresh();
      } catch {
        setOptimisticLocale(null);
        setError("Unable to save language. Please try again.");
      }
    });
  }
  function flipLanguage(event: MouseEvent<HTMLButtonElement>) {
    if (flipping || pending) return;
    const next = displayLocale === "th" ? "en" : "th";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { language(next); return; }
    setFlipping(true);
    event.currentTarget.animate([
      { transform: "perspective(200px) rotateX(0deg)" },
      { transform: "perspective(200px) rotateX(90deg)", offset: .5 },
      { transform: "perspective(200px) rotateX(0deg)" },
    ], { duration: 380, easing: "ease-in-out" });
    flipTimers.current.push(window.setTimeout(() => language(next), 190));
    flipTimers.current.push(window.setTimeout(() => setFlipping(false), 380));
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
    <div className="ft-language" role="group" aria-label="Language" data-locale={displayLocale}>
      <span className="ft-language-indicator" aria-hidden="true"><span ref={languageBlob} className="ft-language-blob" /></span>
      {(["th", "en"] as const).map(l => <button key={l} type="button" aria-pressed={displayLocale === l} disabled={pending} onClick={() => language(l)}>{l.toUpperCase()}</button>)}
    </div>
    <button className="ft-language-mobile" type="button" disabled={pending || flipping} onClick={flipLanguage} aria-label={displayLocale === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}>{displayLocale === "th" ? "EN" : "TH"}</button>
    <button className="ft-theme-switch" type="button" onClick={theme} aria-label={locale === "th" ? "สลับธีม" : "Toggle theme"}>
      <span className="ft-theme-label"><span className="ft-dark-only">{locale === "th" ? "มืด" : "Dark"}</span><span className="ft-light-only">{locale === "th" ? "สว่าง" : "Light"}</span></span>
      <span className="ft-switch-track"><span className="ft-switch-knob"><Moon className="ft-dark-only" size={14}/><Sun className="ft-light-only" size={14}/></span></span>
    </button>
    {error && <span className="ft-control-error" role="alert">{error}</span>}
  </div>;
}
