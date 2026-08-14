"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Nav destinations. The starred three plus Body are the tabs (03-ui-spec.md §6). */
const TABS = [
  { href: "/today", label: "วันนี้" },
  { href: "/schedule", label: "ตาราง" },
  { href: "/analytics", label: "สถิติ" },
  { href: "/body", label: "ร่างกาย" },
] as const;

const ICONS: Record<string, React.ReactNode> = {
  "/today": <path d="M4 5h16M4 12h16M4 19h10" />,
  "/schedule": (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18M8 3v3M16 3v3" />
    </>
  ),
  "/analytics": <path d="M4 19V9M10 19V5M16 19v-6M22 19H2" />,
  "/body": (
    <>
      <circle cx="12" cy="5.5" r="2.5" />
      <path d="M5 11h14M12 11v9M8.5 20l1.5-4M15.5 20L14 16" />
    </>
  ),
};

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** Top bar tabs, shown at ≥ 860px. */
export function TopTabs() {
  const pathname = usePathname();

  return (
    <nav role="tablist" className="hidden gap-0.5 rounded-[10px] bg-surface-2 p-[3px] min-[860px]:flex">
      {TABS.map((tab) => {
        const active = isActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={cn(
              "whitespace-nowrap rounded-[7px] px-[13px] py-1.5 text-[13px] transition",
              active
                ? "bg-surface font-semibold text-text-1 shadow-[0_1px_2px_rgba(0,0,0,.06)]"
                : "font-medium text-text-2 hover:text-text-1",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Bottom nav, shown below 860px: Today · Schedule · [＋] · Analytics · Body.
 * Every target is at least 44×44px (03-ui-spec.md §8).
 */
export function BottomNav() {
  const pathname = usePathname();
  const [left, right] = [TABS.slice(0, 2), TABS.slice(2)];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-page/95 backdrop-blur-md min-[860px]:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-[560px] grid-cols-5 items-center px-2">
        {left.map((tab) => (
          <NavItem key={tab.href} {...tab} active={isActive(pathname, tab.href)} />
        ))}

        <div className="relative grid place-items-center">
          <Link
            href="/today?start=1"
            aria-label="เริ่มเวิร์คเอาท์"
            className="grid size-[52px] -translate-y-3 place-items-center rounded-full bg-s1 shadow-card transition hover:brightness-110"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-6 stroke-on-accent"
              fill="none"
              strokeWidth={2.4}
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        </div>

        {right.map((tab) => (
          <NavItem key={tab.href} {...tab} active={isActive(pathname, tab.href)} />
        ))}
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[52px] flex-col items-center justify-center gap-1 text-[11px] transition",
        active ? "font-semibold text-s1" : "text-text-2",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[19px]"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {ICONS[href]}
      </svg>
      {label}
    </Link>
  );
}
