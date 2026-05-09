// webhooks.orders.create.jsx
// Fired when a new order is placed
// Updates: AnalyticsEvent (cod_order / prepaid_order)
// Creates: ReviewRequest for each fulfilled order

import { authenticate } from "../shopify.server";
import db from "../db.server";

const isCodOrder = (order) => {
  const gateways = order.payment_gateway_names ?? [];
  return gateways.some(g =>
    g.toLowerCase().includes("cod") ||
    g.toLowerCase().includes("cash")
  );
};

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`[Webhook] ${topic} — shop: ${shop}, order: ${payload.name}`);

  const isCod = isCodOrder(payload);
  const orderValue = parseFloat(payload.total_price ?? 0);

  // ── Log analytics event ───────────────────────────────────────────────────
  try {
    await db.analyticsEvent.create({
      data: {
        shop,
        tool: "smart_cart",
        event: isCod ? "cod_order" : "prepaid_order",
        orderId: String(payload.id),
        value: orderValue,
        metadata: JSON.stringify({
          orderName: payload.name,
          gateway: payload.payment_gateway_names,
          currency: payload.currency,
          itemCount: payload.line_items?.length ?? 0,
        }),
      },
    });
  } catch (e) {
    console.error(`[Webhook] AnalyticsEvent failed:`, e.message);
  }

  // ── Create review request ─────────────────────────────────────────────────
  try {
    const settings = await db.reviewSettings.findUnique({ where: { shop } });
    if (settings?.autoRequestEnabled && payload.email) {
      const productIds = JSON.stringify(
        payload.line_items?.map(item => String(item.product_id)) ?? []
      );
      await db.reviewRequest.create({
        data: {
          shop,
          orderId: String(payload.id),
          customerId: payload.customer?.id ? String(payload.customer.id) : null,
          email: payload.email,
          productIds,
          status: "pending",
        },
      });
    }
  } catch (e) {
    console.error(`[Webhook] ReviewRequest failed:`, e.message);
  }

  return new Response(null, { status: 200 });
};
