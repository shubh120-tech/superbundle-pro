// webhooks.app.scopes_update.jsx
// Fired when app scopes change

import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`[Webhook] ${topic} — shop: ${shop}`);
  return new Response(null, { status: 200 });
};
