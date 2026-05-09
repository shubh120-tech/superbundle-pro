// app/routes/api.reviews.jsx
// Public API endpoint called by the product_reviews.liquid block
// Returns reviews for a specific product

import db from "../db.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const productId = url.searchParams.get("product_id");
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const perPage = 10;
  const shop = url.searchParams.get("shop") ??
    request.headers.get("x-shopify-shop-domain") ?? "";

  if (!productId || !shop) {
    return Response.json({ error: "Missing product_id or shop" }, { status: 400 });
  }

  try {
    const where = { shop, productId, published: true };

    const [reviews, total, aggregate, ratingCounts] = await Promise.all([
      db.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true, customerName: true, rating: true,
          title: true, body: true, photoUrls: true,
          verified: true, createdAt: true, reply: true, repliedAt: true,
        },
      }),
      db.review.count({ where }),
      db.review.aggregate({ where, _avg: { rating: true } }),
      db.review.groupBy({
        by: ["rating"],
        where,
        _count: { rating: true },
      }),
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
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (e) {
    console.error("Reviews API error:", e.message);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
};

// Handle review submissions from storefront
export const action = async ({ request }) => {
  const body = await request.json();
  const { productId, customerName, title, body: reviewBody, rating, shop } = body;

  if (!productId || !customerName || !reviewBody || !rating || !shop) {
    return Response.json({ success: false, message: "Missing fields" }, { status: 400 });
  }

  try {
    await db.review.create({
      data: {
        shop,
        productId,
        productTitle: "",
        customerName,
        customerEmail: body.email || "",
        rating: Math.min(5, Math.max(1, parseInt(rating))),
        title: title || "",
        body: reviewBody,
        verified: false,
        published: false, // requires approval
        source: "storefront",
      },
    });

    return Response.json({ success: true }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    console.error("Review submit error:", e.message);
    return Response.json({ success: false, message: "Failed to submit" }, { status: 500 });
  }
};
