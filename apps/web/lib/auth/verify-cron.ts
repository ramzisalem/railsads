import type { NextRequest } from "next/server";

/**
 * Verify that a cron request is authorized.
 * In production, Vercel sends `Authorization: Bearer <CRON_SECRET>`.
 * In development, allows all requests when CRON_SECRET is not set.
 */
export function verifyCronAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === "development";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
