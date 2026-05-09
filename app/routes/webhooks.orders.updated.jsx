// webhooks.orders.updated.jsx
// Fired when an order is updated
// Detects: fulfillment (mark review request as ready to send)
// Detects: prepaid conversion (COD → paid online)

import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`[Webhook] ${topic} — shop: ${shop}, order: ${payload.name}`);

  // ── Mark review request as "sent" when order is fulfilled ─────────────────
  if (payload.fulfillment_status === "fulfilled") {
    try {
      await db.reviewRequest.updateMany({
        where: { shop, orderId: String(payload.id), status: "pending" },
        data: {
          status: "sent",
          sentAt: new Date(),
        },
      });
    } catch (e) {
      console.error(`[Webhook] ReviewRequest update failed:`, e.message);
    }
  }

  // ── Detect prepaid conversion ─────────────────────────────────────────────
  const wasCod = payload.tags?.includes("cod") ||
    payload.payment_gateway_names?.some(g =>
      g.toLowerCase().includes("cod") || g.toLowerCase().includes("cash")
    );
  const isNowPaid = payload.financial_status === "paid" && !wasCod;

  if (isNowPaid) {
    try {
      await db.cartEvent.create({
        data: {
          shop,
          event: "prepaid_switched",
          value: parseFloat(payload.total_price ?? 0),
          metadata: JSON.stringify({ orderName: payload.name }),
        },
      });

      await db.analyticsEvent.create({
        data: {
          shop,
          tool: "smart_cart",
          event: "prepaid_conversion",
          value: parseFloat(payload.total_price ?? 0),
          metadata: JSON.stringify({ orderName: payload.name }),
        },
      });
    } catch (e) {
      console.error(`[Webhook] Prepaid conversion failed:`, e.message);
    }
  }

  return new Response(null, { status: 200 });
};
