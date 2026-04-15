"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/db/supabase-server";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import { ACTIVE_BRAND_COOKIE } from "@/lib/auth/get-current-brand";
import { safeBrandRedirectPath } from "@/lib/auth/safe-brand-redirect-path";

export type ActivateBrandForStudioResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/**
 * Sets the active-brand cookie on the Server Action response.
 * Caller must use `window.location.assign(path)` — not `redirect()` here — so the
 * browser does a full document load. Otherwise App Router can still refetch
 * `/onboarding` after the action (POST … 303) and race the client tree back to step 1.
 */
export async function activateBrandAndGoToStudio(
  brandId: string,
  redirectPath: string
): Promise<ActivateBrandForStudioResult> {
  const log = (msg: string, extra?: Record<string, unknown>) => {
    console.info(`[railsads:onboarding:activate] ${msg}`, { brandId, redirectPathIn: redirectPath, ...extra });
  };

  log("start");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    log("return error: no user");
    return { ok: false, error: "Unauthorized" };
  }

  log("auth ok", { userId: user.id });

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    log("return error: verifyBrandMembership false", { userId: user.id });
    return { ok: false, error: "Forbidden" };
  }

  const path = safeBrandRedirectPath(redirectPath);
  const isProduction = process.env.NODE_ENV === "production";
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BRAND_COOKIE, brandId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
  });

  log("success: cookie set, returning path for window.location.assign", {
    userId: user.id,
    path,
    cookieName: ACTIVE_BRAND_COOKIE,
    secure: isProduction,
  });

  return { ok: true, path };
}
