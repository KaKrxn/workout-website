"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function changeLocale(locale: "th" | "en") {
  if (locale !== "th" && locale !== "en") throw new Error("Invalid language");
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (user) {
    const { error } = await db.from("user_settings").update({ locale }).eq("user_id", user.id);
    if (error) return { error: "Unable to save language. Please try again." };
  }
  (await cookies()).set("locale", locale, { path: "/", sameSite: "lax", maxAge: 31536000 });
  revalidatePath("/", "layout");
  return { error: null };
}
