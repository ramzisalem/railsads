import { validateEnv } from "@/lib/env";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    validateEnv("nodejs");
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    validateEnv("edge");
    await import("./sentry.edge.config");
  }
}
