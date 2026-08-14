import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Routes reachable without a session. Everything else requires one.
 *
 * `/api/cron` is here because cron requests carry no session cookie — Vercel
 * authenticates them with `Authorization: Bearer <CRON_SECRET>`, which each
 * handler checks for itself. Without this the scheduler just gets a 307 to
 * /login and the job silently never runs.
 */
const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth", "/api/cron"];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Returns a human-readable reason the Supabase config is unusable, or null.
 *
 * Worth the lines: every one of these mistakes otherwise surfaces as a bare 500
 * from deep inside the Supabase client, on every page, with nothing in the
 * response saying which variable is wrong.
 */
function describeConfigProblem(url?: string, key?: string): string | null {
  if (!url) return "NEXT_PUBLIC_SUPABASE_URL is not set";
  if (!key) return "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set";

  if (url !== url.trim() || key !== key.trim()) {
    return "a Supabase environment variable has leading or trailing whitespace";
  }
  if (key.startsWith("sb_secret_")) {
    return "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY holds the SECRET key — rotate it now, it is public";
  }
  if (key.startsWith("http")) {
    return "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY looks like a URL, not a key — the two values are swapped";
  }

  // Check the scheme before guessing at content. A project ref can begin with
  // any letters — "eyzsmsaysddkripsfqdr" starts like a JWT but is a perfectly
  // good hostname — so "looks like a key" must never be the first conclusion.
  if (!url.includes("://")) {
    return url.startsWith("sb_")
      ? "NEXT_PUBLIC_SUPABASE_URL holds an API key, not a URL — the two values are swapped"
      : `NEXT_PUBLIC_SUPABASE_URL is missing the scheme — use https://${url.slice(0, 40)}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `NEXT_PUBLIC_SUPABASE_URL is not a valid URL ("${url.slice(0, 40)}")`;
  }
  const isLocal = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (parsed.protocol !== "https:" && !isLocal) {
    return `NEXT_PUBLIC_SUPABASE_URL must use https:// (got ${parsed.protocol}//)`;
  }

  return null;
}

/**
 * Next.js 16 renamed the `middleware` convention to `proxy`.
 *
 * Two jobs: keep the Supabase session cookie fresh on every request, and gate
 * the authenticated routes. The guard here is a redirect for good UX — it is not
 * the security boundary. RLS is (Report/02-data-model.md §7).
 */
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Paths that need no session at all: skip Supabase entirely rather than paying
  // for an auth round trip on every request to the landing page, and so that a
  // misconfigured deployment does not take the public pages down with it.
  if (pathname === "/" || pathname.startsWith("/api/cron")) {
    return NextResponse.next({ request });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Without this the Supabase client throws and every matched route returns a
  // bare 500 with nothing in it to diagnose — including pages that never needed
  // Supabase. Say what is actually wrong instead.
  const problem = describeConfigProblem(url, key);
  // The `!url || !key` is redundant at runtime — describeConfigProblem already
  // covers it — but it is what narrows both to `string` for the call below.
  if (problem || !url || !key) {
    const message = problem ?? "Supabase environment variables are missing";
    console.error(`Supabase configuration problem: ${message}`);
    return new NextResponse(`Server is not configured: ${message}`, {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Must be getUser(), not getSession(): only getUser() revalidates the token
  // with the auth server. Do not put other logic between this and the response.
  //
  // Wrapped because a URL that parses but points nowhere — a typo'd project ref,
  // a paused free-tier project — throws here and would otherwise 500 every page
  // with nothing explaining why.
  let user: { id: string } | null = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch (err) {
    console.error("Could not reach Supabase auth:", err);
    return new NextResponse(
      `Cannot reach Supabase at ${url}. Check the project ref is correct and the ` +
        `project is not paused, then redeploy.`,
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  if (!user && !isPublic(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = searchParams.get("next") ?? "/today";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets. Without this the guard
    // would also block CSS, JS and images.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
