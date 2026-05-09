// webhooks.products.updated.jsx
// Fired when a product is updated
// Keeps review productTitle in sync with Shopify product title

import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`[Webhook] ${topic} — shop: ${shop}, product: ${payload.title}`);

  // Update productTitle on all reviews for this product
  try {
    const productGid = `gid://shopify/Product/${payload.id}`;
    await db.review.updateMany({
      where: { shop, productId: productGid },
      data: { productTitle: payload.title },
    });
  } catch (e) {
    console.error(`[Webhook] Review productTitle sync failed:`, e.message);
  }

  return new Response(null, { status: 200 });
};
