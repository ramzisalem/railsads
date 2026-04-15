/**
 * Shared Stripe subscription status mapping.
 * Used by the webhook handler and cron sync jobs.
 */
export function mapStripeStatus(status: string): string {
  const mapping: Record<string, string> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "unpaid",
    incomplete: "incomplete",
    incomplete_expired: "incomplete",
    paused: "active",
  };
  return mapping[status] ?? "active";
}
