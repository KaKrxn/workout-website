"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/admin", label: "ภาพรวม" },
  { href: "/admin/users", label: "ผู้ใช้" },
  { href: "/admin/admins", label: "ผู้ดูแล" },
  { href: "/admin/logs", label: "บันทึก" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-4 flex gap-0.5 overflow-x-auto rounded-[10px] bg-surface-2 p-[3px]">
      {SECTIONS.map((s) => {
        // Exact match for the index, prefix for the rest, so /admin/users does
        // not also light up ภาพรวม.
        const active = s.href === "/admin" ? pathname === "/admin" : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-[7px] px-[13px] py-1.5 text-[13px] transition",
              active
                ? "bg-surface font-semibold text-text-1 shadow-[0_1px_2px_rgba(0,0,0,.06)]"
                : "font-medium text-text-2 hover:text-text-1",
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
