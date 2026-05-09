import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") ?? "all";
  const rating = url.searchParams.get("rating") ?? "all";
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const perPage = 20;

  let where = { shop: session.shop };
  if (filter === "published") where.published = true;
  if (filter === "pending") where.published = false;
  if (rating !== "all") where.rating = parseInt(rating);

  let reviews = [];
  let total = 0;
  let stats = { total: 0, published: 0, pending: 0, avgRating: 0, fiveStar: 0, fourStar: 0, threeStar: 0, twoStar: 0, oneStar: 0 };

  try {
    const [rows, count, aggregate, ratingCounts] = await Promise.all([
      db.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      db.review.count({ where }),
      db.review.aggregate({
        where: { shop: session.shop },
        _avg: { rating: true },
        _count: true,
      }),
      db.review.groupBy({
        by: ["rating"],
        where: { shop: session.shop },
        _count: { rating: true },
      }),
    ]);

    reviews = rows.map(r => ({
      ...r,
      photoUrls: JSON.parse(r.photoUrls || "[]"),
    }));
    total = count;

    const ratingMap = {};
    ratingCounts.forEach(r => { ratingMap[r.rating] = r._count.rating; });

    stats = {
      total: aggregate._count,
      published: await db.review.count({ where: { shop: session.shop, published: true } }),
      pending: await db.review.count({ where: { shop: session.shop, published: false } }),
      avgRating: aggregate._avg.rating?.toFixed(1) ?? "0.0",
      fiveStar: ratingMap[5] ?? 0,
      fourStar: ratingMap[4] ?? 0,
      threeStar: ratingMap[3] ?? 0,
      twoStar: ratingMap[2] ?? 0,
      oneStar: ratingMap[1] ?? 0,
    };
  } catch (e) {
    console.warn("Reviews query failed:", e.message);
  }

  return { reviews, total, stats, filter, rating, page, perPage };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const reviewId = parseInt(formData.get("reviewId"));

  try {
    if (intent === "publish") {
      await db.review.update({ where: { id: reviewId }, data: { published: true } });
    } else if (intent === "unpublish") {
      await db.review.update({ where: { id: reviewId }, data: { published: false } });
    } else if (intent === "delete") {
      await db.review.delete({ where: { id: reviewId } });
    } else if (intent === "reply") {
      const reply = formData.get("reply");
      await db.review.update({
        where: { id: reviewId },
        data: { reply, repliedAt: new Date() },
      });
    } else if (intent === "bulk_publish") {
      const ids = JSON.parse(formData.get("ids") || "[]");
      await db.review.updateMany({
        where: { id: { in: ids }, shop: session.shop },
        data: { published: true },
      });
    } else if (intent === "bulk_delete") {
      const ids = JSON.parse(formData.get("ids") || "[]");
      await db.review.deleteMany({
        where: { id: { in: ids }, shop: session.shop },
      });
    }
  } catch (e) {
    console.error("Review action failed:", e.message);
    return { success: false, message: e.message };
  }

  return { success: true };
};

function StarRating({ rating, size = 14 }) {
  return (
    <span style={{ color: "#f4a423", fontSize: size }}>
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

function RatingBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
      <span style={{ color: "#6d7175", width: "40px" }}>{label}</span>
      <div style={{ flex: 1, height: "6px", background: "#e1e3e5", borderRadius: "3px" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "3px" }} />
      </div>
      <span style={{ color: "#6d7175", width: "24px", textAlign: "right" }}>{count}</span>
    </div>
  );
}

export default function ReviewsPage() {
  const { reviews, total, stats, filter, rating, page, perPage } = useLoaderData();
  const fetcher = useFetcher();

  const [selectedIds, setSelectedIds] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [activeFilter, setActiveFilter] = useState(filter);
  const [activeRating, setActiveRating] = useState(rating);

  const toggleSelect = (id) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const selectAll = () =>
    setSelectedIds(reviews.map(r => r.id));

  const handleAction = (intent, reviewId, extra = {}) => {
    fetcher.submit({ intent, reviewId, ...extra }, { method: "POST" });
  };

  const handleBulkAction = (intent) => {
    fetcher.submit(
      { intent, ids: JSON.stringify(selectedIds) },
      { method: "POST" }
    );
    setSelectedIds([]);
  };

  const handleReply = (reviewId) => {
    handleAction("reply", reviewId, { reply: replyText });
    setReplyingTo(null);
    setReplyText("");
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <s-page heading="Product Reviews">
      <s-button slot="primary-action" url="/app/reviews/requests">
        ✉️ Request Settings
      </s-button>

      {fetcher.data?.success === false && (
        <s-banner tone="critical">{fetcher.data.message}</s-banner>
      )}

      {/* Stats Overview */}
      <s-section>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "24px", alignItems: "center" }}>

          {/* Big rating display */}
          <div style={{ textAlign: "center", padding: "0 24px", borderRight: "1px solid #e1e3e5" }}>
            <div style={{ fontSize: "56px", fontWeight: 800, color: "#202223", lineHeight: 1 }}>{stats.avgRating}</div>
            <StarRating rating={Math.round(parseFloat(stats.avgRating))} size={20} />
            <div style={{ fontSize: "12px", color: "#6d7175", marginTop: "4px" }}>{stats.total} reviews</div>
          </div>

          {/* Rating bars */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <RatingBar label="5 ★" count={stats.fiveStar} total={stats.total} color="#008060" />
            <RatingBar label="4 ★" count={stats.fourStar} total={stats.total} color="#47c1bf" />
            <RatingBar label="3 ★" count={stats.threeStar} total={stats.total} color="#f4a423" />
            <RatingBar label="2 ★" count={stats.twoStar} total={stats.total} color="#f49342" />
            <RatingBar label="1 ★" count={stats.oneStar} total={stats.total} color="#d72c0d" />
          </div>

          {/* Status counts */}
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "16px", paddingTop: "16px", borderTop: "1px solid #e1e3e5" }}>
            {[
              { label: "Total", value: stats.total, color: "#202223" },
              { label: "Published", value: stats.published, color: "#008060" },
              { label: "Pending", value: stats.pending, color: "#f4a423" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "20px", fontWeight: 700, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: "13px", color: "#6d7175" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </s-section>

      {/* Filters + Bulk actions */}
      <s-section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: "4px" }}>
            {[
              { label: "All", value: "all" },
              { label: "Published", value: "published" },
              { label: "Pending", value: "pending" },
            ].map(f => (
              <a
                key={f.value}
                href={`?filter=${f.value}&rating=${activeRating}`}
                style={{
                  padding: "7px 14px", borderRadius: "6px", fontSize: "13px",
                  fontWeight: activeFilter === f.value ? 600 : 400,
                  background: activeFilter === f.value ? "#202223" : "#f6f6f7",
                  color: activeFilter === f.value ? "white" : "#6d7175",
                  textDecoration: "none",
                }}
              >
                {f.label}
              </a>
            ))}
          </div>

          {/* Rating filter */}
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#6d7175" }}>Rating:</span>
            {["all", "5", "4", "3", "2", "1"].map(r => (
              <a
                key={r}
                href={`?filter=${activeFilter}&rating=${r}`}
                style={{
                  padding: "5px 10px", borderRadius: "6px", fontSize: "12px",
                  background: activeRating === r ? "#f4a423" : "#f6f6f7",
                  color: activeRating === r ? "white" : "#6d7175",
                  textDecoration: "none", fontWeight: activeRating === r ? 600 : 400,
                }}
              >
                {r === "all" ? "All" : `${r}★`}
              </a>
            ))}
          </div>

          {/* Bulk actions */}
          {selectedIds.length > 0 && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "#6d7175" }}>{selectedIds.length} selected</span>
              <button onClick={() => handleBulkAction("bulk_publish")} style={actionBtnStyle("#008060")}>
                ✓ Publish All
              </button>
              <button onClick={() => handleBulkAction("bulk_delete")} style={actionBtnStyle("#d72c0d")}>
                🗑 Delete All
              </button>
              <button onClick={() => setSelectedIds([])} style={actionBtnStyle("#6d7175")}>
                ✕ Clear
              </button>
            </div>
          )}
        </div>

        {selectedIds.length === 0 && reviews.length > 0 && (
          <button onClick={selectAll} style={{ marginTop: "8px", ...actionBtnStyle("#6d7175") }}>
            Select all {reviews.length}
          </button>
        )}
      </s-section>

      {/* Reviews List */}
      <s-section>
        {reviews.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>⭐</div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "#202223", marginBottom: "8px" }}>No reviews yet</div>
            <div style={{ fontSize: "13px", color: "#6d7175" }}>
              Set up review request emails to start collecting reviews automatically.
            </div>
            <a href="/app/reviews/requests" style={{
              display: "inline-block", marginTop: "16px",
              padding: "10px 20px", background: "#008060", color: "white",
              borderRadius: "7px", textDecoration: "none", fontSize: "13px", fontWeight: 600,
            }}>
              Set up review requests →
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {reviews.map((review, idx) => (
              <div key={review.id} style={{
                padding: "16px 0",
                borderBottom: idx < reviews.length - 1 ? "1px solid #f1f1f1" : "none",
              }}>
                <div style={{ display: "flex", gap: "12px" }}>

                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(review.id)}
                    onChange={() => toggleSelect(review.id)}
                    style={{ marginTop: "4px", flexShrink: 0 }}
                  />

                  {/* Avatar */}
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "50%",
                    background: `hsl(${review.customerName.charCodeAt(0) * 10}, 60%, 70%)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "14px", fontWeight: 700, color: "white", flexShrink: 0,
                  }}>
                    {review.customerName.charAt(0).toUpperCase()}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: "14px", color: "#202223" }}>{review.customerName}</span>
                        {review.verified && (
                          <span style={{ marginLeft: "8px", fontSize: "11px", color: "#008060", fontWeight: 600 }}>✓ Verified</span>
                        )}
                        <div style={{ fontSize: "12px", color: "#6d7175", marginTop: "2px" }}>{review.productTitle}</div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                        <StarRating rating={review.rating} />
                        <span style={{ fontSize: "11px", color: "#6d7175" }}>
                          {new Date(review.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                        <span style={{
                          fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "99px",
                          background: review.published ? "#e3f1eb" : "#fff4e5",
                          color: review.published ? "#008060" : "#b5731d",
                        }}>
                          {review.published ? "Published" : "Pending"}
                        </span>
                      </div>
                    </div>

                    {review.title && (
                      <div style={{ fontWeight: 600, fontSize: "13px", color: "#202223", marginBottom: "4px" }}>{review.title}</div>
                    )}
                    <div style={{ fontSize: "13px", color: "#6d7175", lineHeight: 1.6 }}>{review.body}</div>

                    {/* Photos */}
                    {review.photoUrls?.length > 0 && (
                      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                        {review.photoUrls.map((url, i) => (
                          <img key={i} src={url} alt="" style={{ width: 60, height: 60, borderRadius: 6, objectFit: "cover", border: "1px solid #e1e3e5" }} />
                        ))}
                      </div>
                    )}

                    {/* Existing reply */}
                    {review.reply && (
                      <div style={{
                        marginTop: "10px", padding: "10px 14px",
                        background: "#f6f6f7", borderRadius: "8px",
                        borderLeft: "3px solid #5C6AC4",
                        fontSize: "13px", color: "#202223",
                      }}>
                        <strong style={{ fontSize: "12px", color: "#5C6AC4" }}>Your reply:</strong>
                        <div style={{ marginTop: "4px" }}>{review.reply}</div>
                      </div>
                    )}

                    {/* Reply input */}
                    {replyingTo === review.id && (
                      <div style={{ marginTop: "10px" }}>
                        <textarea
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder="Write your reply..."
                          rows={3}
                          style={{
                            width: "100%", padding: "8px 12px", borderRadius: "6px",
                            border: "1px solid #c9cccf", fontSize: "13px", resize: "vertical",
                            outline: "none", boxSizing: "border-box",
                          }}
                        />
                        <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                          <button onClick={() => handleReply(review.id)} style={actionBtnStyle("#5C6AC4")}>
                            Send Reply
                          </button>
                          <button onClick={() => setReplyingTo(null)} style={actionBtnStyle("#6d7175")}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                      {!review.published ? (
                        <button onClick={() => handleAction("publish", review.id)} style={actionBtnStyle("#008060")}>
                          ✓ Publish
                        </button>
                      ) : (
                        <button onClick={() => handleAction("unpublish", review.id)} style={actionBtnStyle("#6d7175")}>
                          Unpublish
                        </button>
                      )}
                      <button
                        onClick={() => { setReplyingTo(review.id); setReplyText(review.reply || ""); }}
                        style={actionBtnStyle("#5C6AC4")}
                      >
                        {review.reply ? "✏️ Edit Reply" : "💬 Reply"}
                      </button>
                      <button onClick={() => handleAction("delete", review.id)} style={actionBtnStyle("#d72c0d")}>
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </s-section>

      {/* Pagination */}
      {totalPages > 1 && (
        <s-section>
          <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
            {page > 1 && (
              <a href={`?filter=${activeFilter}&rating=${activeRating}&page=${page - 1}`} style={pageBtnStyle(false)}>← Prev</a>
            )}
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
              <a key={p} href={`?filter=${activeFilter}&rating=${activeRating}&page=${p}`} style={pageBtnStyle(p === page)}>{p}</a>
            ))}
            {page < totalPages && (
              <a href={`?filter=${activeFilter}&rating=${activeRating}&page=${page + 1}`} style={pageBtnStyle(false)}>Next →</a>
            )}
          </div>
        </s-section>
      )}

      {/* Aside */}
      <s-section slot="aside" heading="📊 Review Stats">
        {[
          { label: "Total reviews", value: stats.total },
          { label: "Published", value: stats.published },
          { label: "Pending approval", value: stats.pending },
          { label: "Average rating", value: `${stats.avgRating} ★` },
          { label: "5-star reviews", value: `${stats.total > 0 ? Math.round((stats.fiveStar / stats.total) * 100) : 0}%` },
        ].map(s => (
          <div key={s.label} style={{
            display: "flex", justifyContent: "space-between",
            padding: "8px 0", borderBottom: "1px solid #f1f1f1", fontSize: "13px",
          }}>
            <span style={{ color: "#6d7175" }}>{s.label}</span>
            <span style={{ fontWeight: 600, color: "#202223" }}>{s.value}</span>
          </div>
        ))}
      </s-section>

      <s-section slot="aside" heading="⚡ Quick Actions">
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            { label: "📧 Request Settings", href: "/app/reviews/requests" },
            { label: "🎨 Widget Settings", href: "/app/reviews/widgets" },
            { label: "📥 Import Reviews", href: "/app/reviews/import" },
          ].map(a => (
            <a key={a.label} href={a.href} style={{
              display: "block", padding: "9px 12px",
              background: "#f6f6f7", borderRadius: "7px",
              textDecoration: "none", fontSize: "13px",
              fontWeight: 500, color: "#202223",
              border: "1px solid #e1e3e5",
            }}>
              {a.label}
            </a>
          ))}
        </div>
      </s-section>

    </s-page>
  );
}

const actionBtnStyle = (color) => ({
  padding: "5px 12px", borderRadius: "6px", border: "none",
  cursor: "pointer", fontSize: "12px", fontWeight: 600,
  background: `${color}18`, color, transition: "background 0.15s",
});

const pageBtnStyle = (active) => ({
  display: "inline-block", padding: "6px 12px",
  borderRadius: "6px", textDecoration: "none", fontSize: "13px",
  fontWeight: active ? 700 : 400,
  background: active ? "#202223" : "#f6f6f7",
  color: active ? "white" : "#6d7175",
});

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
