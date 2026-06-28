import "server-only";

import { getStripe } from "@/lib/stripe";
import { grantCredits } from "@/lib/billing/wallet";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");

  let stripe: ReturnType<typeof getStripe>;
  let event: import("stripe").Stripe.Event;

  try {
    stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      raw,
      sig ?? "",
      process.env.STRIPE_WEBHOOK_SECRET ?? ""
    );
  } catch (e) {
    return new Response("invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as import("stripe").Stripe.Checkout.Session;

    const userId =
      s.metadata?.userId ?? s.client_reference_id ?? undefined;
    const creditsMicros = Number(s.metadata?.creditsMicros);

    if (!userId || !Number.isFinite(creditsMicros) || creditsMicros <= 0) {
      return new Response("ignored: missing metadata", { status: 200 });
    }

    // Only credit once the money is actually captured. For mode:"payment",
    // checkout.session.completed can fire with payment_status "unpaid" for
    // delayed/asynchronous payment methods — granting then would hand out
    // credits before capture. Cards are always "paid", so this is invisible
    // to the standard flow and closes the async-payment hole.
    if (s.payment_status !== "paid") {
      return new Response("ignored: not paid", { status: 200 });
    }

    try {
      await grantCredits({
        userId,
        creditsMicros,
        kind: "purchase",
        amountPaidCents: s.amount_total ?? 0,
        stripeSessionId: s.id,
        stripeEventId: event.id,
      });
    } catch (e) {
      console.error("[billing/webhook]", e);
      return new Response("grant failed", { status: 500 });
    }
  }

  return new Response("ok", { status: 200 });
}
