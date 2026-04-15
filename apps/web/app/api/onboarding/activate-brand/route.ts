import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import { ACTIVE_BRAND_COOKIE } from "@/lib/auth/get-current-brand";
import { safeBrandRedirectPath } from "@/lib/auth/safe-brand-redirect-path";
import { parseBody, activateBrandSchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: body, error: parseErr } = await parseBody(request, activateBrandSchema);
  if (parseErr) return parseErr;

  const isMember = await verifyBrandMembership(supabase, user.id, body.brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isProduction = process.env.NODE_ENV === "production";
  const path = safeBrandRedirectPath(body.redirectPath);
  // JSON + Set-Cookie on this response (not cookies() from next/headers). Fetch clients
  // treat 303 as !res.ok; some environments also omit Location from response.headers — so
  // return an explicit same-origin path in the body instead of relying on Location.
  const response = NextResponse.json({ ok: true as const, redirect: path });
  response.cookies.set(ACTIVE_BRAND_COOKIE, body.brandId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
  });

  return response;
}
