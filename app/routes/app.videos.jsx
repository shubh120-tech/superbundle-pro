import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  let settings = null;
  let videos = [];
  let stats = { totalViews: 0, totalClicks: 0, totalConversions: 0, totalVideos: 0 };

  try {
    [settings, videos] = await Promise.all([
      db.videoSettings.findUnique({ where: { shop: session.shop } }),
      db.video.findMany({ where: { shop: session.shop }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    const agg = await db.video.aggregate({
      where: { shop: session.shop },
      _sum: { views: true, clicks: true, conversions: true },
      _count: true,
    });
    stats = {
      totalViews: agg._sum.views ?? 0,
      totalClicks: agg._sum.clicks ?? 0,
      totalConversions: agg._sum.conversions ?? 0,
      totalVideos: agg._count,
    };
  } catch (e) { console.warn("DB error:", e.message); }
  return { settings, videos, stats };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "toggle_publish") {
    const videoId = parseInt(formData.get("videoId"));
    const published = formData.get("published") === "true";
    try {
      await db.video.update({ where: { id: videoId }, data: { published: !published } });
    } catch (e) { return { success: false, message: e.message }; }
    return { success: true };
  }

  if (intent === "delete") {
    const videoId = parseInt(formData.get("videoId"));
    try { await db.video.delete({ where: { id: videoId } }); }
    catch (e) { return { success: false, message: e.message }; }
    return { success: true };
  }

  if (intent === "save_settings") {
    const data = Object.fromEntries(formData);
    try {
      await db.videoSettings.upsert({
        where: { shop: session.shop },
        update: {
          autoplayEnabled: data.autoplayEnabled === "true",
          muteByDefault: data.muteByDefault === "true",
          showProductTags: data.showProductTags === "true",
          showAddToCart: data.showAddToCart === "true",
          defaultWidgetType: data.defaultWidgetType || "carousel",
          primaryColor: data.primaryColor || "#5C6AC4",
        },
        create: {
          shop: session.shop,
          autoplayEnabled: data.autoplayEnabled === "true",
          muteByDefault: data.muteByDefault === "true",
          showProductTags: data.showProductTags === "true",
          showAddToCart: data.showAddToCart === "true",
          defaultWidgetType: data.defaultWidgetType || "carousel",
          primaryColor: data.primaryColor || "#5C6AC4",
        },
      });
    } catch (e) { return { success: false, message: e.message }; }
    return { success: true };
  }

  return { success: false, message: "Unknown intent" };
};

export default function VideosPage() {
  const { settings: s, videos, stats } = useLoaderData();
  const fetcher = useFetcher();
  const isSaving = fetcher.state === "submitting";

  const [autoplay, setAutoplay] = useState(s?.autoplayEnabled ?? true);
  const [muteByDefault, setMuteByDefault] = useState(s?.muteByDefault ?? true);
  const [showProductTags, setShowProductTags] = useState(s?.showProductTags ?? true);
  const [showAddToCart, setShowAddToCart] = useState(s?.showAddToCart ?? true);
  const [defaultWidgetType, setDefaultWidgetType] = useState(s?.defaultWidgetType ?? "carousel");
  const [primaryColor, setPrimaryColor] = useState(s?.primaryColor ?? "#5C6AC4");
  const [activeTab, setActiveTab] = useState("videos");

  const handleSaveSettings = () => {
    fetcher.submit({
      intent: "save_settings",
      autoplayEnabled: String(autoplay), muteByDefault: String(muteByDefault),
      showProductTags: String(showProductTags), showAddToCart: String(showAddToCart),
      defaultWidgetType, primaryColor,
    }, { method: "POST" });
  };

  const handleVideoAction = (intent, videoId, extra = {}) => {
    fetcher.submit({ intent, videoId, ...extra }, { method: "POST" });
  };

  const tabs = ["videos", "settings"];
  const tabLabels = { videos: "🎥 Videos", settings: "⚙️ Settings" };

  return (
    <s-page heading="Shoppable Videos">
      <s-button slot="primary-action" url="/app/videos/import">⬇️ Import Videos</s-button>

      {fetcher.data?.success === false && <s-banner tone="critical">{fetcher.data.message}</s-banner>}

      {/* Stats */}
      <s-section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
          {[
            { label: "Total Videos", value: stats.totalVideos, icon: "🎥" },
            { label: "Total Views", value: stats.totalViews.toLocaleString("en-IN"), icon: "👁️" },
            { label: "Total Clicks", value: stats.totalClicks.toLocaleString("en-IN"), icon: "👆" },
            { label: "Conversions", value: stats.totalConversions, icon: "🛒" },
          ].map(s => (
            <div key={s.label} style={{ background: "#f6f6f7", borderRadius: "10px", padding: "16px", border: "1px solid #e1e3e5" }}>
              <div style={{ fontSize: "22px", marginBottom: "6px" }}>{s.icon}</div>
              <div style={{ fontSize: "22px", fontWeight: 700, color: "#202223" }}>{s.value}</div>
              <div style={{ fontSize: "12px", color: "#6d7175", marginTop: "2px" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </s-section>

      <s-section>
        <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid #e1e3e5" }}>
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "10px 16px", border: "none", cursor: "pointer", fontSize: "13px",
              fontWeight: activeTab === tab ? "600" : "400", background: "transparent",
              color: activeTab === tab ? "#202223" : "#6d7175",
              borderBottom: activeTab === tab ? "2px solid #202223" : "2px solid transparent",
              marginBottom: "-1px",
            }}>{tabLabels[tab]}</button>
          ))}
        </div>
      </s-section>

      {activeTab === "videos" && (
        <s-section heading="Your Videos">
          {videos.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎥</div>
              <div style={{ fontSize: "16px", fontWeight: 600, color: "#202223", marginBottom: "8px" }}>No videos yet</div>
              <div style={{ fontSize: "13px", color: "#6d7175", marginBottom: "16px" }}>Import from TikTok, Instagram, or upload your own videos.</div>
              <a href="/app/videos/import" style={{ padding: "10px 20px", background: "#5C6AC4", color: "white", borderRadius: "7px", textDecoration: "none", fontSize: "13px", fontWeight: 600 }}>
                Import Videos →
              </a>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
              {videos.map(v => (
                <div key={v.id} style={{ border: "1px solid #e1e3e5", borderRadius: "10px", overflow: "hidden", background: "white" }}>
                  <div style={{ position: "relative", paddingTop: "177%", background: "#1a1a2e" }}>
                    {v.thumbnailUrl ? (
                      <img src={v.thumbnailUrl} alt={v.title} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: "36px" }}>🎥</div>
                    )}
                    <div style={{ position: "absolute", top: "8px", right: "8px" }}>
                      <span style={{
                        fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "99px",
                        background: v.published ? "#008060" : "#f4a423", color: "white",
                      }}>
                        {v.published ? "Live" : "Draft"}
                      </span>
                    </div>
                    <div style={{ position: "absolute", bottom: "8px", left: "8px", display: "flex", gap: "8px" }}>
                      <span style={{ fontSize: "11px", color: "white", background: "rgba(0,0,0,0.5)", padding: "2px 6px", borderRadius: "4px" }}>👁 {v.views}</span>
                      <span style={{ fontSize: "11px", color: "white", background: "rgba(0,0,0,0.5)", padding: "2px 6px", borderRadius: "4px" }}>🛒 {v.conversions}</span>
                    </div>
                  </div>
                  <div style={{ padding: "10px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#202223", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title || "Untitled"}</div>
                    <div style={{ fontSize: "11px", color: "#6d7175", marginBottom: "8px", textTransform: "capitalize" }}>{v.source}</div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => handleVideoAction("toggle_publish", v.id, { published: String(v.published) })} style={{
                        flex: 1, padding: "5px", border: "none", borderRadius: "5px", cursor: "pointer",
                        fontSize: "11px", fontWeight: 600,
                        background: v.published ? "#fff4e5" : "#e3f1eb",
                        color: v.published ? "#b5731d" : "#008060",
                      }}>
                        {v.published ? "Unpublish" : "Publish"}
                      </button>
                      <button onClick={() => handleVideoAction("delete", v.id)} style={{ padding: "5px 8px", border: "none", borderRadius: "5px", cursor: "pointer", background: "#fbe9e7", color: "#d72c0d", fontSize: "12px" }}>🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </s-section>
      )}

      {activeTab === "settings" && (
        <s-section heading="Video Player Settings">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              { label: "Autoplay videos", hint: "Videos play automatically when visible", value: autoplay, set: setAutoplay },
              { label: "Mute by default", hint: "Videos start muted (recommended for autoplay)", value: muteByDefault, set: setMuteByDefault },
              { label: "Show product tags", hint: "Display tagged product info on video", value: showProductTags, set: setShowProductTags },
              { label: "Show Add to Cart button", hint: "Allow customers to add products directly from video", value: showAddToCart, set: setShowAddToCart },
            ].map(item => (
              <div key={item.label} style={rowStyle}>
                <div><div style={labelStyle}>{item.label}</div><div style={hintStyle}>{item.hint}</div></div>
                <label style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={item.value} onChange={e => item.set(e.target.checked)} style={{ display: "none" }} />
                  <div style={{ ...toggleStyle, background: item.value ? "#008060" : "#c9cccf" }}><div style={{ ...toggleDotStyle, transform: item.value ? "translateX(20px)" : "translateX(2px)" }} /></div>
                </label>
              </div>
            ))}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Default widget type</label>
              <div style={{ display: "flex", gap: "10px" }}>
                {["carousel", "story", "grid", "floating"].map(t => (
                  <button key={t} onClick={() => setDefaultWidgetType(t)} style={{
                    padding: "7px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px",
                    border: `2px solid ${defaultWidgetType === t ? primaryColor : "#e1e3e5"}`,
                    background: defaultWidgetType === t ? `${primaryColor}10` : "white",
                    color: defaultWidgetType === t ? primaryColor : "#6d7175",
                    fontWeight: defaultWidgetType === t ? 600 : 400, textTransform: "capitalize",
                  }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Player accent color</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ width: "44px", height: "36px", border: "1px solid #c9cccf", borderRadius: "6px", cursor: "pointer" }} />
                <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ ...inputStyle, maxWidth: "140px", fontFamily: "monospace" }} />
              </div>
            </div>
            <button onClick={handleSaveSettings} style={{ padding: "10px 24px", background: "#5C6AC4", color: "white", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: 700, cursor: "pointer", alignSelf: "flex-start" }}>
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </s-section>
      )}

      <s-section slot="aside" heading="🔗 Quick Links">
        {[
          { label: "📱 Manage Widgets", href: "/app/videos/widgets" },
          { label: "⬇️ Import Videos", href: "/app/videos/import" },
        ].map(l => (
          <div key={l.label} style={{ padding: "9px 0", borderBottom: "1px solid #f1f1f1" }}>
            <a href={l.href} style={{ fontSize: "13px", color: "#2c6ecb", textDecoration: "none", fontWeight: 500 }}>{l.label} →</a>
          </div>
        ))}
      </s-section>

      <s-section slot="aside" heading="💡 Tips">
        <s-paragraph>Shoppable videos increase time-on-site by 40% on average.</s-paragraph>
        <s-paragraph>Tag 2-3 products per video for highest conversion rates.</s-paragraph>
        <s-paragraph>Story-style widgets work best on mobile — most Indian shoppers browse on mobile.</s-paragraph>
      </s-section>
    </s-page>
  );
}

const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #c9cccf", fontSize: "13px", outline: "none", boxSizing: "border-box", background: "white" };
const fieldGroupStyle = { display: "flex", flexDirection: "column", gap: "4px" };
const labelStyle = { fontSize: "13px", fontWeight: "600", color: "#202223", display: "block" };
const hintStyle = { fontSize: "12px", color: "#6d7175" };
const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#f6f6f7", borderRadius: "8px" };
const toggleStyle = { width: "44px", height: "24px", borderRadius: "99px", position: "relative", transition: "background 0.2s", cursor: "pointer" };
const toggleDotStyle = { position: "absolute", top: "2px", width: "20px", height: "20px", borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "transform 0.2s" };

export const headers = (headersArgs) => boundary.headers(headersArgs);
