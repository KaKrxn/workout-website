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
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Set them in the deployment's environment variables and redeploy — " +
        "env vars are inlined at build time, so a redeploy is required.",
    );
    return new NextResponse(
      "Server is not configured: Supabase environment variables are missing.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
