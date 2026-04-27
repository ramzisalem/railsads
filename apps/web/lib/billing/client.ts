/**
 * Client-side helpers for surfacing 402 (billing) errors from API routes.
 *
 * The credit gate on the server returns:
 *   { error, message, remaining, cost, upgradeUrl }   with status 402
 *
 * Components that hit AI endpoints should call `parseApiError` instead of
 * a bare `res.json()` when handling failures so 402s are surfaced as a
 * dedicated `BillingError` (which the UI renders with an "Upgrade" CTA),
 * and other failures fall through as a generic Error.
 */

export type BillingErrorCode =
  | "subscription_required"
  | "trial_exhausted"
  | "insufficient_credits";

export class BillingError extends Error {
  code: BillingErrorCode;
  upgradeUrl: string;
  remaining: number;
  cost: number;

  constructor(opts: {
    code: BillingErrorCode;
    message: string;
    upgradeUrl?: string;
    remaining?: number;
    cost?: number;
  }) {
    super(opts.message);
    this.name = "BillingError";
    this.code = opts.code;
    this.upgradeUrl = opts.upgradeUrl ?? "/billing";
    this.remaining = opts.remaining ?? 0;
    this.cost = opts.cost ?? 0;
  }
}

export function isBillingError(err: unknown): err is BillingError {
  return err instanceof BillingError;
}

const BILLING_CODES: ReadonlySet<BillingErrorCode> = new Set([
  "subscription_required",
  "trial_exhausted",
  "insufficient_credits",
]);

/**
 * Inspect a fetch Response, throwing a `BillingError` on 402 and a regular
 * `Error` on any other non-2xx. Returns the parsed JSON body on success.
 *
 * Usage:
 *   const data = await fetchJson<MyResponse>(res);
 */
export async function fetchJson<T = unknown>(res: Response): Promise<T> {
  if (res.ok) {
    return (await res.json()) as T;
  }

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    remaining?: number;
    cost?: number;
    upgradeUrl?: string;
  };

  if (res.status === 402 && data.error && BILLING_CODES.has(data.error as BillingErrorCode)) {
    throw new BillingError({
      code: data.error as BillingErrorCode,
      message: data.message ?? data.error,
      upgradeUrl: data.upgradeUrl,
      remaining: data.remaining,
      cost: data.cost,
    });
  }

  throw new Error(data.message || data.error || `Request failed (${res.status})`);
}
