export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { requireUserIdApi } from "@/lib/current-user";
import { getStripe } from "@/lib/stripe";
import { getPack } from "@/lib/billing/packs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const userId = await requireUserIdApi();
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { packId } = await req.json().catch(() => ({}));
  const pack = getPack(packId);
  if (!pack) {
    return new Response(JSON.stringify({ error: "invalid pack" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return new Response(JSON.stringify({ error: "user not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stripe = getStripe();
    let stripeCustomerId: string;
    if (!user.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { userId },
      });
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id },
      });
      stripeCustomerId = customer.id;
    } else {
      stripeCustomerId = user.stripeCustomerId;
    }

    const origin =
      req.headers.get("origin") ??
      process.env.AUTH_URL ??
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomerId,
      client_reference_id: userId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.priceCents,
            product_data: {
              name: `CCA-F Tutor credits — ${pack.label}`,
            },
          },
        },
      ],
      metadata: {
        userId,
        packId: pack.id,
        creditsMicros: String(pack.creditsMicros),
      },
      payment_intent_data: {
        metadata: {
          userId,
          packId: pack.id,
          creditsMicros: String(pack.creditsMicros),
        },
      },
      success_url: `${origin}/chat?topup=success`,
      cancel_url: `${origin}/chat?topup=cancel`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[billing/checkout]", e);
    return new Response(JSON.stringify({ error: "checkout failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
