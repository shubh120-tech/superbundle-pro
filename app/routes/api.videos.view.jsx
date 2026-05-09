// app/routes/api.videos.view.jsx
// Tracks video views from storefront

import db from "../db.server";

export const action = async ({ request }) => {
  try {
    const body = await request.json();
    const { videoUrl, shop } = body;

    if (videoUrl && shop) {
      await db.video.updateMany({
        where: { shop, videoUrl },
        data: { views: { increment: 1 } },
      });
    }
  } catch (e) {
    // Silently fail
  }

  return Response.json({ ok: true }, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
};
