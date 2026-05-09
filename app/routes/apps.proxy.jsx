// app/routes/apps.proxy.jsx
// App Proxy — handles requests from storefront liquid blocks
// Shopify routes /apps/superbundle-pro/* → your app URL /apps/proxy/*
// This allows liquid blocks to call your API securely

import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  // Verify the request is from Shopify
  const { storefront } = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const path = url.searchParams.get("_path") ?? url.pathname;
  const shop = url.searchParams.get("shop") ?? "";
  const productId = url.searchParams.get("product_id") ?? "";
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const perPage = 10;

  // Route based on path
  if (path.includes("reviews")) {
    return handleReviews({ shop, productId, page, perPage });
  }

  if (path.includes("videos")) {
    return handleVideos({ shop, productId });
  }

  return Response.json({ error: "Not found" }, { status: 404 });
};

export const action = async ({ request }) => {
  const { storefront } = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const path = url.searchParams.get("_path") ?? url.pathname;

  if (path.includes("reviews")) {
    const body = await request.json();
    return handleReviewSubmit(body);
  }

  if (path.includes("videos/view")) {
    const body = await request.json();
    return handleVideoView(body);
  }

  return Response.json({ error: "Not found" }, { status: 404 });
};

// ── Reviews handler ───────────────────────────────────────────────────────────
async function handleReviews({ shop, productId, page, perPage }) {
  if (!shop) return Response.json({ reviews: [], stats: null });

  try {
    const where = { shop, published: true };
    if (productId) where.productId = productId;

    const [reviews, total, aggregate, ratingCounts] = await Promise.all([
      db.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true, customerName: true, rating: true,
          title: true, body: true, photoUrls: true,
          verified: true, createdAt: true, reply: true,
        },
      }),
      db.review.count({ where }),
      db.review.aggregate({ where, _avg: { rating: true } }),
      db.review.groupBy({ by: ["rating"], where, _count: { rating: true } }),
    ]);

    const ratingMap = {};
    ratingCounts.forEach(r => { ratingMap[r.rating] = r._count.rating; });

    return Response.json({
      reviews: reviews.map(r => ({
        ...r,
        photoUrls: JSON.parse(r.photoUrls || "[]"),
      })),
      hasMore: total > page * perPage,
      stats: {
        total,
        avgRating: aggregate._avg.rating?.toFixed(1) ?? "0.0",
        star5: ratingMap[5] ?? 0,
        star4: ratingMap[4] ?? 0,
        star3: ratingMap[3] ?? 0,
        star2: ratingMap[2] ?? 0,
        star1: ratingMap[1] ?? 0,
      },
    });
  } catch (e) {
    console.error("Reviews proxy error:", e.message);
    return Response.json({ reviews: [], stats: null });
  }
}

// ── Review submit handler ─────────────────────────────────────────────────────
async function handleReviewSubmit(body) {
  const { productId, customerName, title, body: reviewBody, rating, shop } = body;

  if (!productId || !customerName || !reviewBody || !rating || !shop) {
    return Response.json({ success: false, message: "Missing fields" }, { status: 400 });
  }

  try {
    await db.review.create({
      data: {
        shop, productId, productTitle: "",
        customerName,
        customerEmail: body.email || "",
        rating: Math.min(5, Math.max(1, parseInt(rating))),
        title: title || "",
        body: reviewBody,
        verified: false,
        published: false,
        source: "storefront",
      },
    });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ success: false, message: e.message }, { status: 500 });
  }
}

// ── Videos handler ────────────────────────────────────────────────────────────
async function handleVideos({ shop, productId }) {
  if (!shop) return Response.json({ videos: [] });

  try {
    const videos = await db.video.findMany({
      where: { shop, published: true },
      orderBy: { sortOrder: "asc" },
      take: 20,
      select: {
        id: true, title: true, videoUrl: true,
        thumbnailUrl: true, productIds: true,
        views: true, source: true,
      },
    });

    const filtered = productId
      ? videos.filter(v => {
          try {
            const ids = JSON.parse(v.productIds || "[]");
            return ids.includes(productId) || ids.length === 0;
          } catch { return true; }
        })
      : videos;

    return Response.json({ videos: filtered });
  } catch (e) {
    return Response.json({ videos: [] });
  }
}

// ── Video view tracker ────────────────────────────────────────────────────────
async function handleVideoView(body) {
  try {
    if (body.videoUrl && body.shop) {
      await db.video.updateMany({
        where: { shop: body.shop, videoUrl: body.videoUrl },
        data: { views: { increment: 1 } },
      });
    }
  } catch (e) { /* silent */ }
  return Response.json({ ok: true });
}