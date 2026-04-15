import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client that bypasses RLS.
 * ONLY use server-side for billing/webhooks/cron/admin operations.
 * NEVER expose to the frontend.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
