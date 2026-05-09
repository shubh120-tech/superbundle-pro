// app/routes/api.videos.jsx
// Public API endpoint called by the product_videos.liquid block
// Returns videos tagged with a specific product

import db from "../db.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const productId = url.searchParams.get("product_id");
  const shop = url.searchParams.get("shop") ??
    request.headers.get("x-shopify-shop-domain") ?? "";

  if (!shop) {
    return Response.json({ error: "Missing shop" }, { status: 400 });
  }

  try {
    // Get all published videos for this shop
    // Filter by productId if provided
    const where = { shop, published: true };

    const videos = await db.video.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      take: 20,
      select: {
        id: true, title: true, videoUrl: true,
        thumbnailUrl: true, productIds: true,
        views: true, clicks: true, conversions: true,
        source: true,
      },
    });

    // Filter by productId if provided
    const filtered = productId
      ? videos.filter(v => {
          try {
            const ids = JSON.parse(v.productIds || "[]");
            return ids.includes(productId) || ids.length === 0;
          } catch { return true; }
        })
      : videos;

    return Response.json({
      videos: filtered,
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (e) {
    console.error("Videos API error:", e.message);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
};

// Track video view
export const action = async ({ request }) => {
  const url = new URL(request.url);
  const trackType = url.pathname.includes("view") ? "view" : "click";

  try {
    const body = await request.json();
    const { videoUrl, shop } = body;

    if (videoUrl) {
      await db.video.updateMany({
        where: { shop, videoUrl },
        data: {
          views: trackType === "view" ? { increment: 1 } : undefined,
          clicks: trackType === "click" ? { increment: 1 } : undefined,
        },
      });
    }
  } catch (e) {
    // Silently fail tracking
  }

  return Response.json({ ok: true }, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
};
