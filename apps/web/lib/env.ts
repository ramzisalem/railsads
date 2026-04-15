/**
 * Central environment variable validation.
 * Call `validateEnv()` at server startup to fail fast on missing config.
 */

interface EnvVar {
  name: string;
  required: boolean;
  /** Only validate on server (not edge runtime) */
  serverOnly?: boolean;
}

const ENV_VARS: EnvVar[] = [
  // Supabase (public — required everywhere)
  { name: "NEXT_PUBLIC_SUPABASE_URL", required: true },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true },

  // Supabase service role (server only)
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, serverOnly: true },

  // App URL
  { name: "NEXT_PUBLIC_APP_URL", required: true },

  // OpenAI
  { name: "OPENAI_API_KEY", required: true, serverOnly: true },

  // Stripe
  { name: "STRIPE_SECRET_KEY", required: true, serverOnly: true },
  { name: "STRIPE_WEBHOOK_SECRET", required: true, serverOnly: true },
  { name: "STRIPE_PRICE_STARTER", required: true, serverOnly: true },
  { name: "STRIPE_PRICE_PRO", required: true, serverOnly: true },

  // Cron auth
  { name: "CRON_SECRET", required: true, serverOnly: true },

  // Sentry (optional — graceful degradation)
  { name: "NEXT_PUBLIC_SENTRY_DSN", required: false },
  { name: "SENTRY_ORG", required: false },
  { name: "SENTRY_PROJECT", required: false },
];

export function validateEnv(runtime: "nodejs" | "edge" = "nodejs"): void {
  const missing: string[] = [];

  for (const v of ENV_VARS) {
    if (!v.required) continue;
    if (v.serverOnly && runtime === "edge") continue;
    if (!process.env[v.name]) {
      missing.push(v.name);
    }
  }

  if (missing.length > 0) {
    const message = `Missing required environment variables:\n  ${missing.join("\n  ")}`;

    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    } else {
      console.warn(`[env] WARNING: ${message}\n  Some features will not work.`);
    }
  }
}
