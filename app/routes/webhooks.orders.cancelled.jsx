// webhooks.orders.cancelled.jsx
// Fired when an order is cancelled
// Logs analytics event, cancels pending review request

import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`[Webhook] ${topic} — shop: ${shop}, order: ${payload.name}`);

  // ── Log analytics event ───────────────────────────────────────────────────
  try {
    await db.analyticsEvent.create({
      data: {
        shop,
        tool: "smart_cart",
        event: "order_cancelled",
        value: parseFloat(payload.total_price ?? 0),
        metadata: JSON.stringify({
          orderName: payload.name,
          cancelReason: payload.cancel_reason,
          cancelledAt: payload.cancelled_at,
        }),
      },
    });
  } catch (e) {
    console.error(`[Webhook] AnalyticsEvent failed:`, e.message);
  }

  // ── Cancel pending review request ─────────────────────────────────────────
  try {
    await db.reviewRequest.updateMany({
      where: { shop, orderId: String(payload.id), status: "pending" },
      data: { status: "cancelled" },
    });
  } catch (e) {
    console.error(`[Webhook] ReviewRequest cancel failed:`, e.message);
  }

  return new Response(null, { status: 200 });
};
