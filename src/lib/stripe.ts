import "server-only";
import Stripe from "stripe";

declare global {
  // eslint-disable-next-line no-var
  var __stripe: Stripe | undefined;
}

/**
 * Lazily construct the Stripe client. Constructing eagerly at module load
 * would throw during `next build` — page-data collection evaluates route
 * modules, and the Stripe SDK throws on an empty key — and would wrongly make
 * the build depend on a runtime secret. Build it on first use instead, so the
 * key is only required when a request actually hits a billing route.
 */
export function getStripe(): Stripe {
  if (!globalThis.__stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    globalThis.__stripe = new Stripe(key);
  }
  return globalThis.__stripe;
}
