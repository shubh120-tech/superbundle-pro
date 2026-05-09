import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);

  // Fetch shop info
  let shopInfo = { name: "", email: "", domain: "" };
  try {
    const res = await admin.graphql(`
      query { shop { name email myshopifyDomain currencyCode } }
    `);
    const data = await res.json();
    shopInfo = data?.data?.shop ?? shopInfo;
  } catch (e) {
    console.error("GraphQL error:", e.message);
  }

  // Fetch tool settings
  let toolSettings = { reviewsEnabled: true, smartCartEnabled: true, videosEnabled: true };
  try {
    const ts = await db.toolSettings.findUnique({ where: { shop: session.shop } });
    if (ts) toolSettings = ts;
  } catch (e) {
    console.warn("ToolSettings not found:", e.message);
  }

  // Fetch stats
  let stats = {
    totalReviews: 0, avgRating: 0,
    cartEvents: 0, prepaidConversions: 0,
    totalVideoViews: 0, videoConversions: 0,
  };
  try {
    const [reviewCount, reviewAvg, cartEventCount, prepaidCount, videoCount, videoStats] = await Promise.all([
      db.review.count({ where: { shop: session.shop, published: true } }),
      db.review.aggregate({ where: { shop: session.shop, published: true }, _avg: { rating: true } }),
      db.cartEvent.count({ where: { shop: session.shop } }),
      db.cartEvent.count({ where: { shop: session.shop, event: "prepaid_switched" } }),
      db.video.count({ where: { shop: session.shop } }),
      db.video.aggregate({ where: { shop: session.shop }, _sum: { views: true, conversions: true } }),
    ]);
    stats = {
      totalReviews: reviewCount,
      avgRating: reviewAvg._avg.rating?.toFixed(1) ?? "0.0",
      cartEvents: cartEventCount,
      prepaidConversions: prepaidCount,
      totalVideos: videoCount,
      totalVideoViews: videoStats._sum.views ?? 0,
      videoConversions: videoStats._sum.conversions ?? 0,
    };
  } catch (e) {
    console.warn("Stats query failed:", e.message);
  }

  return { shopInfo, toolSettings, stats, shop: session.shop };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const tool = formData.get("tool");
  const enabled = formData.get("enabled") === "true";

  try {
    await db.toolSettings.upsert({
      where: { shop: session.shop },
      update: { [`${tool}Enabled`]: enabled },
      create: {
        shop: session.shop,
        reviewsEnabled: tool === "reviews" ? enabled : true,
        smartCartEnabled: tool === "smartCart" ? enabled : true,
        videosEnabled: tool === "videos" ? enabled : true,
      },
    });
  } catch (e) {
    console.error("Failed to update tool settings:", e.message);
  }

  return { success: true };
};

const TOOLS = [
  {
    id: "reviews",
    key: "reviewsEnabled",
    name: "Product Reviews",
    icon: "⭐",
    description: "Collect photo & video reviews, display widgets, boost SEO with rich snippets.",
    color: "#f4a423",
    href: "/app/reviews",
    stats: (s) => [`${s.totalReviews} reviews`, `${s.avgRating ?? "0.0"}★ avg`],
    features: ["Unlimited review requests", "Photo & video reviews", "SEO rich snippets", "Q&A", "Import from Amazon"],
  },
  {
    id: "smartCart",
    key: "smartCartEnabled",
    name: "Smart Cart",
    icon: "🛒",
    description: "Boost AOV with cart drawer, milestone rewards, upsell, and prepaid nudge.",
    color: "#008060",
    href: "/app/smart-cart",
    stats: (s) => [`${s.cartEvents} events`, `${s.prepaidConversions} prepaid`],
    features: ["Cart drawer", "Free shipping bar", "Milestone rewards", "In-cart upsell", "COD/Prepaid optimize"],
  },
  {
    id: "videos",
    key: "videosEnabled",
    name: "Shoppable Videos",
    icon: "🎥",
    description: "Turn TikTok & Instagram reels into shoppable video widgets on your store.",
    color: "#5C6AC4",
    href: "/app/videos",
    stats: (s) => [`${s.totalVideos ?? 0} videos`, `${s.totalVideoViews ?? 0} views`],
    features: ["TikTok & Instagram import", "Shoppable video widgets", "Autoplay carousel", "Story style", "Video analytics"],
  },
];

export default function Dashboard() {
  const { shopInfo, toolSettings, stats, shop } = useLoaderData();

  return (
    <s-page heading="SuperBundle Pro">

      {/* Welcome banner */}
      <s-section>
        <div style={{
          background: "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)",
          borderRadius: "12px", padding: "28px 32px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#fff" }}>
              Welcome back, {shopInfo.name || shop} 👋
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>
              3 powerful tools — one app. Here's your performance overview.
            </p>
          </div>
          <div style={{ display: "flex", gap: "24px" }}>
            {[
              { label: "Reviews", value: stats.totalReviews, icon: "⭐" },
              { label: "Cart Events", value: stats.cartEvents, icon: "🛒" },
              { label: "Video Views", value: stats.totalVideoViews, icon: "🎥" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "24px" }}>{s.icon}</div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "#fff", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </s-section>

      {/* Tool Cards */}
      <s-section heading="Your Tools">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {TOOLS.map(tool => {
            const isEnabled = toolSettings[tool.key] ?? true;
            const toolStats = tool.stats(stats);
            return (
              <div key={tool.id} style={{
                border: `2px solid ${isEnabled ? tool.color : "#e1e3e5"}`,
                borderRadius: "12px", padding: "20px",
                background: isEnabled ? `${tool.color}06` : "white",
                transition: "all 0.2s",
              }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "28px" }}>{tool.icon}</span>
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: "#202223" }}>{tool.name}</div>
                      <div style={{ fontSize: "11px", color: isEnabled ? tool.color : "#6d7175", fontWeight: 600 }}>
                        {isEnabled ? "● Active" : "○ Disabled"}
                      </div>
                    </div>
                  </div>
                  {/* Toggle */}
                  <form method="post">
                    <input type="hidden" name="tool" value={tool.id} />
                    <input type="hidden" name="enabled" value={String(!isEnabled)} />
                    <button type="submit" style={{
                      padding: "5px 12px", borderRadius: "6px", border: "none",
                      cursor: "pointer", fontSize: "12px", fontWeight: 600,
                      background: isEnabled ? tool.color : "#f6f6f7",
                      color: isEnabled ? "white" : "#6d7175",
                    }}>
                      {isEnabled ? "Enabled" : "Enable"}
                    </button>
                  </form>
                </div>

                {/* Description */}
                <p style={{ fontSize: "13px", color: "#6d7175", margin: "0 0 12px", lineHeight: 1.5 }}>
                  {tool.description}
                </p>

                {/* Stats */}
                <div style={{ display: "flex", gap: "12px", marginBottom: "14px" }}>
                  {toolStats.map((s, i) => (
                    <div key={i} style={{
                      background: "#f6f6f7", borderRadius: "6px",
                      padding: "6px 10px", fontSize: "12px", fontWeight: 600, color: "#202223",
                    }}>
                      {s}
                    </div>
                  ))}
                </div>

                {/* Features */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "16px" }}>
                  {tool.features.map(f => (
                    <div key={f} style={{ display: "flex", gap: "6px", fontSize: "12px", color: "#6d7175" }}>
                      <span style={{ color: tool.color }}>✓</span>
                      {f}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <a href={tool.href} style={{
                  display: "block", textAlign: "center",
                  padding: "9px", borderRadius: "7px",
                  background: isEnabled ? tool.color : "#f6f6f7",
                  color: isEnabled ? "white" : "#6d7175",
                  textDecoration: "none", fontSize: "13px", fontWeight: 600,
                }}>
                  {isEnabled ? `Configure ${tool.name} →` : "Enable to configure"}
                </a>
              </div>
            );
          })}
        </div>
      </s-section>

      {/* Quick Setup Checklist */}
      <s-section heading="🚀 Quick Setup">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
          {[
            { step: "1", title: "Set up Reviews", desc: "Configure email requests and widget display", href: "/app/reviews", done: stats.totalReviews > 0 },
            { step: "2", title: "Configure Smart Cart", desc: "Set free shipping threshold and milestones", href: "/app/smart-cart", done: false },
            { step: "3", title: "Add Shoppable Videos", desc: "Import from TikTok or upload your own", href: "/app/videos", done: (stats.totalVideos ?? 0) > 0 },
          ].map(item => (
            <a key={item.step} href={item.href} style={{
              display: "block", padding: "16px", borderRadius: "10px",
              border: `1px solid ${item.done ? "#008060" : "#e1e3e5"}`,
              background: item.done ? "#f1f8f5" : "white",
              textDecoration: "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%",
                  background: item.done ? "#008060" : "#f6f6f7",
                  color: item.done ? "white" : "#6d7175",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "13px", fontWeight: 700, flexShrink: 0,
                }}>
                  {item.done ? "✓" : item.step}
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#202223" }}>{item.title}</div>
              </div>
              <div style={{ fontSize: "12px", color: "#6d7175", paddingLeft: "38px" }}>{item.desc}</div>
            </a>
          ))}
        </div>
      </s-section>

      {/* Aside */}
      <s-section slot="aside" heading="📦 SuperBundle Pro">
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {[
            { label: "Plan", value: "Free" },
            { label: "Tools active", value: `${Object.values(toolSettings).filter(Boolean).length}/3` },
            { label: "Total reviews", value: stats.totalReviews },
            { label: "Avg rating", value: `${stats.avgRating}★` },
          ].map(s => (
            <div key={s.label} style={{
              display: "flex", justifyContent: "space-between",
              padding: "8px 0", borderBottom: "1px solid #f1f1f1", fontSize: "13px",
            }}>
              <span style={{ color: "#6d7175" }}>{s.label}</span>
              <span style={{ fontWeight: 600, color: "#202223" }}>{s.value}</span>
            </div>
          ))}
        </div>
      </s-section>

      <s-section slot="aside" heading="💡 Tips">
        <s-paragraph>Enable all 3 tools for the best results — they work together to increase conversions.</s-paragraph>
        <s-paragraph>Reviews with photos convert 3× better than text-only reviews.</s-paragraph>
        <s-paragraph>Shoppable videos increase time-on-site by 40% on average.</s-paragraph>
      </s-section>

    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};