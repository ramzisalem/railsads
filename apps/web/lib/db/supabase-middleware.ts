import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ACTIVE_BRAND_COOKIE = "railsads-active-brand";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const activeBrandCookie = request.cookies.get(ACTIVE_BRAND_COOKIE)?.value ?? null;

  const publicPaths = ["/login", "/signup", "/forgot-password", "/auth/callback"];
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p));

  const isApiPath = pathname.startsWith("/api");

  if (!user && !isPublicPath && !isApiPath) {
    console.warn("[railsads:proxy] redirect → /login", {
      method: request.method,
      pathname: pathname + (request.nextUrl.search || ""),
    });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    console.info("[railsads:proxy] redirect → / (logged-in on auth page)", { pathname });
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (user && !isPublicPath && !pathname.startsWith("/onboarding") && !pathname.startsWith("/api")) {
    if (!activeBrandCookie) {
      // Cookie missing — check if the user actually has a brand before sending to onboarding.
      const { data: membership } = await supabase
        .from("brand_members")
        .select("brand_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (membership) {
        // Auto-restore the cookie so the user doesn't hit onboarding again.
        console.info("[railsads:proxy] restoring active-brand cookie from membership", {
          brandId: membership.brand_id,
          pathname,
        });
        const isProduction = process.env.NODE_ENV === "production";
        supabaseResponse.cookies.set(ACTIVE_BRAND_COOKIE, membership.brand_id, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          httpOnly: true,
          sameSite: "lax",
          secure: isProduction,
        });
      } else {
        console.warn("[railsads:proxy] redirect → /onboarding (no brand membership)", {
          method: request.method,
          pathname: pathname + (request.nextUrl.search || ""),
        });
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        return NextResponse.redirect(url);
      }
    }
  }

  if (
    process.env.NODE_ENV === "development" &&
    user &&
    pathname.startsWith("/studio") &&
    activeBrandCookie
  ) {
    console.info("[railsads:proxy] studio allowed", {
      method: request.method,
      pathname: pathname + (request.nextUrl.search || ""),
      activeBrandPreview: `${activeBrandCookie.slice(0, 8)}…`,
    });
  }

  return supabaseResponse;
}
