"use client";

import { createContext, useContext } from "react";
import type { Dict } from "@/lib/i18n/th";

const I18nContext = createContext<Dict | null>(null);

export function I18nProvider({
  dict,
  children,
}: {
  dict: Dict;
  children: React.ReactNode;
}) {
  return <I18nContext.Provider value={dict}>{children}</I18nContext.Provider>;
}

export function useT(): Dict {
  const dict = useContext(I18nContext);
  if (!dict) throw new Error("useT must be used inside I18nProvider");
  return dict;
}

export function useMessage(key: string | null): string | null {
  const dict = useT();
  if (!key) return null;

  const value = key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);

  return typeof value === "string" ? value : key;
}
