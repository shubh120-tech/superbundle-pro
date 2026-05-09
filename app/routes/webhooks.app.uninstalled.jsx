// webhooks.app.uninstalled.jsx
// Fired when merchant uninstalls SuperBundle Pro
// Cleans up ALL shop data from every table

import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);
  console.log(`[Webhook] ${topic} — shop: ${shop}`);

  // Delete session
  if (session) {
    await db.session.deleteMany({ where: { shop } }).catch(() => {});
  }

  // Clean up all shop data in parallel
  await Promise.all([
    db.appSettings.deleteMany({ where: { shop } }).catch(() => {}),
    db.toolSettings.deleteMany({ where: { shop } }).catch(() => {}),
    db.reviewSettings.deleteMany({ where: { shop } }).catch(() => {}),
    db.review.deleteMany({ where: { shop } }).catch(() => {}),
    db.reviewRequest.deleteMany({ where: { shop } }).catch(() => {}),
    db.reviewQA.deleteMany({ where: { shop } }).catch(() => {}),
    db.smartCartSettings.deleteMany({ where: { shop } }).catch(() => {}),
    db.cartEvent.deleteMany({ where: { shop } }).catch(() => {}),
    db.videoSettings.deleteMany({ where: { shop } }).catch(() => {}),
    db.video.deleteMany({ where: { shop } }).catch(() => {}),
    db.videoWidget.deleteMany({ where: { shop } }).catch(() => {}),
    db.analyticsEvent.deleteMany({ where: { shop } }).catch(() => {}),
  ]);

  console.log(`[Webhook] Cleanup complete for shop: ${shop}`);
  return new Response(null, { status: 200 });
};
