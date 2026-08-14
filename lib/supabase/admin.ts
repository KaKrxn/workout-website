import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role client. **Bypasses RLS entirely** — server-side only.
 *
 * The `server-only` import above makes the build fail if this module is ever
 * pulled into a Client Component, which is the failure mode that would leak the
 * secret key into the browser bundle (Report/06-deploy-vercel.md §3.2).
 *
 * Only used where a user genuinely cannot act on their own behalf yet:
 * provisioning at signup, and the cron jobs.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set");

  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
