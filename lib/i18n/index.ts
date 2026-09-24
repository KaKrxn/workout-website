import "server-only";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { en } from "./en";
import { th, type Dict } from "./th";

export type Locale = "th" | "en";

export async function getLocale(): Promise<Locale> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data } = await supabase
      .from("user_settings")
      .select("locale")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data?.locale === "en" || data?.locale === "th") return data.locale;
  }

  const cookieLocale = (await cookies()).get("locale")?.value;
  if (cookieLocale === "en" || cookieLocale === "th") return cookieLocale;

  const accept = (await headers()).get("accept-language") ?? "";
  return accept.toLowerCase().includes("th") ? "th" : "en";
}

export async function getDictionary(): Promise<Dict> {
  return (await getLocale()) === "en" ? en : th;
}

export function getByPath(dict: Dict, key: string): string {
  const value = key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);

  return typeof value === "string" ? value : key;
}
