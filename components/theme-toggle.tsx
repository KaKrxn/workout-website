"use client";

import { useTheme } from "next-themes";

/**
 * Theme toggle.
 *
 * Which icon shows is decided in CSS from `data-theme` on <html>, not from React
 * state. That keeps the server and client markup identical — reading the resolved
 * theme during render is a hydration mismatch, and the usual `mounted` flag fixes
 * it by calling setState from an effect, which cascades a second render.
 *
 * The label stays theme-independent for the same reason; "toggle theme" is
 * accurate in both directions.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="สลับธีมสว่าง/มืด"
      title="สลับธีมสว่าง/มืด"
      className="grid size-[34px] flex-none place-items-center rounded-[9px] border border-border transition hover:bg-surface-2"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4 stroke-text-2"
        fill="none"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Sun — shown in light mode */}
        <g className="dark:hidden">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2v2M12 20v2M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M2 12h2M20 12h2M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5" />
        </g>
        {/* Moon — shown in dark mode */}
        <path className="hidden dark:block" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    </button>
  );
}
