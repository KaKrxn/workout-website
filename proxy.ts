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
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
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
    },
  );

  // Must be getUser(), not getSession(): only getUser() revalidates the token
  // with the auth server. Do not put other logic between this and the response.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, searchParams } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = searchParams.get("next") ?? "/today";
    url.search = "";
    return NextResponse.redirect(url);
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
