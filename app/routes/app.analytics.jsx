import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const range = url.searchParams.get("range") ?? "30d";
  const daysMap = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
  const since = new Date(Date.now() - (daysMap[range] ?? 30) * 86400000);

  let orders = [];
  let reviewStats = { total: 0, avgRating: 0, published: 0 };
  let cartStats = { events: 0, prepaidSwitched: 0, upsellAdded: 0, discountApplied: 0 };
  let videoStats = { views: 0, clicks: 0, conversions: 0 };
  let topProducts = [];

  try {
    // Orders from Shopify
    const res = await admin.graphql(`
      query getOrders {
        orders(first: 250, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
              totalPriceSet { shopMoney { amount currencyCode } }
              paymentGatewayNames
              displayFulfillmentStatus
              cancelReason
              lineItems(first: 5) {
                edges {
                  node {
                    title
                    quantity
                    originalUnitPriceSet { shopMoney { amount } }
                  }
                }
              }
            }
          }
        }
      }
    `);
    const data = await res.json();
    orders = data?.data?.orders?.edges?.map(e => e.node) ?? [];

    // DB stats
    const [rStats, rAvg, cEvents, vCount, vStats] = await Promise.all([
      db.review.count({ where: { shop: session.shop, published: true } }),
      db.review.aggregate({ where: { shop: session.shop, published: true }, _avg: { rating: true } }),
      db.cartEvent.groupBy({ by: ["event"], where: { shop: session.shop, createdAt: { gte: since } }, _count: { event: true } }),
      db.video.count({ where: { shop: session.shop } }),
      db.video.aggregate({ where: { shop: session.shop }, _sum: { views: true, clicks: true, conversions: true } }),
    ]);

    reviewStats = { total: rStats, avgRating: rAvg._avg.rating?.toFixed(1) ?? "0.0", published: rStats };
    cEvents.forEach(e => {
      cartStats.events += e._count.event;
      if (e.event === "prepaid_switched") cartStats.prepaidSwitched = e._count.event;
      if (e.event === "upsell_added") cartStats.upsellAdded = e._count.event;
      if (e.event === "discount_applied") cartStats.discountApplied = e._count.event;
    });
    videoStats = { 
      total: vCount ?? 0,
      views: vStats._sum.views ?? 0, 
      clicks: vStats._sum.clicks ?? 0, 
      conversions: vStats._sum.conversions ?? 0 
    };

    // Top products
    const productMap = {};
    orders.forEach(o => {
      o.lineItems?.edges?.forEach(({ node: item }) => {
        if (!productMap[item.title]) productMap[item.title] = { title: item.title, units: 0, revenue: 0 };
        productMap[item.title].units += item.quantity;
        productMap[item.title].revenue += parseFloat(item.originalUnitPriceSet?.shopMoney?.amount ?? 0) * item.quantity;
      });
    });
    topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  } catch (e) { console.error("Analytics error:", e.message); }

  const isCod = o => o.paymentGatewayNames?.some(g => g.toLowerCase().includes("cod") || g.toLowerCase().includes("cash"));
  const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.totalPriceSet?.shopMoney?.amount ?? 0), 0);
  const codOrders = orders.filter(isCod);

  return {
    range, topProducts, reviewStats, cartStats, videoStats,
    orderStats: {
      total: orders.length,
      revenue: totalRevenue.toFixed(2),
      avgOrderValue: orders.length ? (totalRevenue / orders.length).toFixed(2) : "0.00",
      codOrders: codOrders.length,
      codRate: orders.length ? ((codOrders.length / orders.length) * 100).toFixed(1) : "0.0",
      fulfillmentRate: orders.length ? ((orders.filter(o => o.displayFulfillmentStatus === "FULFILLED").length / orders.length) * 100).toFixed(1) : "0.0",
    },
  };
};

const fmt = n => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function AnalyticsPage() {
  const { range, topProducts, reviewStats, cartStats, videoStats, orderStats } = useLoaderData();
  const navigate = useNavigate();

  return (
    <s-page heading="Analytics">
      <s-section>
        <div style={{ display: "flex", gap: "8px" }}>
          {[{ label: "Today", value: "1d" }, { label: "7 days", value: "7d" }, { label: "30 days", value: "30d" }, { label: "90 days", value: "90d" }].map(r => (
            <button key={r.value} onClick={() => navigate(`?range=${r.value}`)} style={{
              padding: "7px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "13px",
              fontWeight: range === r.value ? "600" : "400",
              border: range === r.value ? "2px solid #202223" : "1px solid #c9cccf",
              background: range === r.value ? "#202223" : "white",
              color: range === r.value ? "white" : "#202223",
            }}>{r.label}</button>
          ))}
        </div>
      </s-section>

      {/* Order Stats */}
      <s-section heading="📦 Order Overview">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
          {[
            { label: "Total Revenue", value: fmt(orderStats.revenue), icon: "💰" },
            { label: "Total Orders", value: orderStats.total, icon: "📦" },
            { label: "Avg Order Value", value: fmt(orderStats.avgOrderValue), icon: "🛒" },
            { label: "COD Orders", value: orderStats.codOrders, icon: "💵" },
            { label: "COD Rate", value: `${orderStats.codRate}%`, icon: "📊" },
            { label: "Fulfillment Rate", value: `${orderStats.fulfillmentRate}%`, icon: "✅" },
          ].map(s => (
            <div key={s.label} style={{ background: "white", border: "1px solid #e1e3e5", borderRadius: "10px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "12px", color: "#6d7175", marginBottom: "4px" }}>{s.label}</div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "#202223" }}>{s.value}</div>
              </div>
              <span style={{ fontSize: "24px" }}>{s.icon}</span>
            </div>
          ))}
        </div>
      </s-section>

      {/* Tool Performance */}
      <s-section heading="🛠️ Tool Performance">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {/* Reviews */}
          <div style={{ border: "1px solid #f4a423", borderRadius: "10px", padding: "16px", background: "#fff9f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span style={{ fontSize: "20px" }}>⭐</span>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#202223" }}>Product Reviews</span>
            </div>
            {[
              { label: "Total reviews", value: reviewStats.total },
              { label: "Avg rating", value: `${reviewStats.avgRating} ★` },
              { label: "Published", value: reviewStats.published },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "13px", borderBottom: "1px solid #f4a42320" }}>
                <span style={{ color: "#6d7175" }}>{s.label}</span>
                <span style={{ fontWeight: 600, color: "#202223" }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Smart Cart */}
          <div style={{ border: "1px solid #008060", borderRadius: "10px", padding: "16px", background: "#f1f8f5" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span style={{ fontSize: "20px" }}>🛒</span>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#202223" }}>Smart Cart</span>
            </div>
            {[
              { label: "Cart events", value: cartStats.events },
              { label: "Upsell added", value: cartStats.upsellAdded },
              { label: "Prepaid switched", value: cartStats.prepaidSwitched },
              { label: "Discounts applied", value: cartStats.discountApplied },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "13px", borderBottom: "1px solid #00806020" }}>
                <span style={{ color: "#6d7175" }}>{s.label}</span>
                <span style={{ fontWeight: 600, color: "#202223" }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Videos */}
          <div style={{ border: "1px solid #5C6AC4", borderRadius: "10px", padding: "16px", background: "#f8f7ff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span style={{ fontSize: "20px" }}>🎥</span>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#202223" }}>Shoppable Videos</span>
            </div>
            {[
              { label: "Total videos", value: videoStats.total ?? 0 },
              { label: "Total views", value: (videoStats.views ?? 0).toLocaleString("en-IN") },
              { label: "Conversions", value: videoStats.conversions ?? 0 },
              { label: "CVR", value: videoStats.views > 0 ? `${((videoStats.conversions / videoStats.views) * 100).toFixed(1)}%` : "0%" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "13px", borderBottom: "1px solid #5C6AC420" }}>
                <span style={{ color: "#6d7175" }}>{s.label}</span>
                <span style={{ fontWeight: 600, color: "#202223" }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </s-section>

      {/* Top Products */}
      <s-section heading="🏆 Top Products">
        {topProducts.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#6d7175", fontSize: "13px" }}>No orders in this period yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e1e3e5" }}>
                {["Product", "Units Sold", "Revenue"].map(h => (
                  <th key={h} style={{ textAlign: h === "Product" ? "left" : "right", padding: "10px 12px", fontWeight: 600, color: "#6d7175", fontSize: "12px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f1f1" }}>
                  <td style={{ padding: "12px" }}>{p.title}</td>
                  <td style={{ padding: "12px", textAlign: "right" }}>{p.units}</td>
                  <td style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>{fmt(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </s-section>

      <s-section slot="aside" heading="📊 Quick Stats">
        {[
          { label: "Reviews collected", value: reviewStats.total },
          { label: "Avg rating", value: `${reviewStats.avgRating} ★` },
          { label: "Video views", value: videoStats.views },
          { label: "Cart events", value: cartStats.events },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f1f1", fontSize: "13px" }}>
            <span style={{ color: "#6d7175" }}>{s.label}</span>
            <span style={{ fontWeight: 600 }}>{s.value}</span>
          </div>
        ))}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);