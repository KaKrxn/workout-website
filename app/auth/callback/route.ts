import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { provisionUser } from "@/lib/provision";

/**
 * OAuth / email-confirmation landing point. Exchanges the code for a session,
 * then sends the user on.
 *
 * The redirect URL for this route must be allow-listed in Supabase, including
 * the preview wildcard — Report/06-deploy-vercel.md §6.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");

  // Only follow same-site paths, never an absolute URL from the query string.
  const next = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/today";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  // Provision here rather than in the app layout — a layout renders concurrently
  // with the page beneath it, so provisioning there races the page's own query.
  // Idempotent, so returning OAuth users cost one cheap count query.
  if (data.user) await provisionUser(data.user.id);

  // Behind a proxy the deployment's own origin is the right base
  // (x-forwarded-host is set by Vercel).
  const forwardedHost = request.headers.get("x-forwarded-host");
  const base =
    process.env.NODE_ENV === "development" || !forwardedHost
      ? origin
      : `https://${forwardedHost}`;

  return NextResponse.redirect(`${base}${next}`);
}
