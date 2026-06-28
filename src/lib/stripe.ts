import "server-only";
import Stripe from "stripe";

function createStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
}

declare global {
  // eslint-disable-next-line no-var
  var __stripe: Stripe | undefined;
}

export const stripe = globalThis.__stripe ?? createStripeClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__stripe = stripe;
}
