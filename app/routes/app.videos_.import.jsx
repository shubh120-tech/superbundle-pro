import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  let settings = null;
  let recentImports = [];
  try {
    [settings, recentImports] = await Promise.all([
      db.videoSettings.findUnique({ where: { shop: session.shop } }),
      db.video.findMany({ where: { shop: session.shop, source: { in: ["tiktok", "instagram"] } }, orderBy: { createdAt: "desc" }, take: 10 }),
    ]);
  } catch (e) { console.warn("DB error:", e.message); }
  return { settings, recentImports };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "connect_social") {
    const platform = formData.get("platform");
    const handle = formData.get("handle");
    try {
      await db.videoSettings.upsert({
        where: { shop: session.shop },
        update: {
          [`${platform}Connected`]: true,
          [`${platform}Handle`]: handle,
        },
        create: {
          shop: session.shop,
          [`${platform}Connected`]: true,
          [`${platform}Handle`]: handle,
        },
      });
    } catch (e) { return { success: false, message: e.message }; }
    return { success: true, message: `${platform} connected successfully!` };
  }

  if (intent === "import_video") {
    const videoUrl = formData.get("videoUrl");
    const source = formData.get("source");
    const title = formData.get("title") || "";
    const autoPublish = formData.get("autoPublish") === "true";

    try {
      await db.video.create({
        data: {
          shop: session.shop,
          title, videoUrl,
          source, published: autoPublish,
          thumbnailUrl: "",
          productIds: "[]",
        },
      });
    } catch (e) { return { success: false, message: e.message }; }
    return { success: true, message: "Video imported successfully!" };
  }

  return { success: false, message: "Unknown intent" };
};

export default function VideoImport() {
  const { settings: s, recentImports } = useLoaderData();
  const fetcher = useFetcher();
  const isSaving = fetcher.state === "submitting";

  const [activeTab, setActiveTab] = useState("tiktok");
  const [tiktokHandle, setTiktokHandle] = useState(s?.tiktokHandle ?? "");
  const [instagramHandle, setInstagramHandle] = useState(s?.instagramHandle ?? "");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [autoPublish, setAutoPublish] = useState(false);

  const handleConnect = (platform, handle) => {
    fetcher.submit({ intent: "connect_social", platform, handle }, { method: "POST" });
  };

  const handleImport = (source) => {
    fetcher.submit({ intent: "import_video", videoUrl, title: videoTitle, source, autoPublish: String(autoPublish) }, { method: "POST" });
    setVideoUrl("");
    setVideoTitle("");
  };

  const tabs = ["tiktok", "instagram", "upload", "history"];
  const tabLabels = { tiktok: "📱 TikTok", instagram: "📸 Instagram", upload: "⬆️ Upload", history: "📋 History" };

  return (
    <s-page heading="Import Videos">
      {fetcher.data?.success && <s-banner tone="success">{fetcher.data.message}</s-banner>}
      {fetcher.data?.success === false && <s-banner tone="critical">{fetcher.data.message}</s-banner>}

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

      {/* TikTok */}
      {activeTab === "tiktok" && (
        <s-section heading="Import from TikTok" description="Connect your TikTok account to import videos directly.">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "16px", padding: "16px",
              background: s?.tiktokConnected ? "#f1f8f5" : "#f6f6f7",
              border: `1px solid ${s?.tiktokConnected ? "#008060" : "#e1e3e5"}`, borderRadius: "10px",
            }}>
              <span style={{ fontSize: "32px" }}>📱</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "14px", color: "#202223" }}>TikTok</div>
                <div style={{ fontSize: "12px", color: "#6d7175" }}>
                  {s?.tiktokConnected ? `Connected: @${s.tiktokHandle}` : "Not connected"}
                </div>
              </div>
              <span style={{
                fontSize: "12px", fontWeight: 600, padding: "4px 12px", borderRadius: "99px",
                background: s?.tiktokConnected ? "#e3f1eb" : "#f6f6f7",
                color: s?.tiktokConnected ? "#008060" : "#6d7175",
              }}>
                {s?.tiktokConnected ? "✓ Connected" : "Not connected"}
              </span>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>TikTok handle</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="text" value={tiktokHandle} onChange={e => setTiktokHandle(e.target.value)} placeholder="@yourhandle" style={{ ...inputStyle, maxWidth: "240px" }} />
                <button onClick={() => handleConnect("tiktok", tiktokHandle)} disabled={!tiktokHandle || isSaving}
                  style={{ padding: "8px 16px", background: tiktokHandle ? "#202223" : "#c9cccf", color: "white", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: 600, cursor: tiktokHandle ? "pointer" : "not-allowed" }}>
                  Connect
                </button>
              </div>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Import by video URL</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="text" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://tiktok.com/@handle/video/..." style={inputStyle} />
                <button onClick={() => handleImport("tiktok")} disabled={!videoUrl || isSaving}
                  style={{ padding: "8px 16px", background: videoUrl ? "#202223" : "#c9cccf", color: "white", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: 600, cursor: videoUrl ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>
                  {isSaving ? "Importing..." : "Import"}
                </button>
              </div>
            </div>
          </div>
        </s-section>
      )}

      {/* Instagram */}
      {activeTab === "instagram" && (
        <s-section heading="Import from Instagram" description="Connect your Instagram account to import Reels.">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "16px", padding: "16px",
              background: s?.instagramConnected ? "#f1f8f5" : "#f6f6f7",
              border: `1px solid ${s?.instagramConnected ? "#008060" : "#e1e3e5"}`, borderRadius: "10px",
            }}>
              <span style={{ fontSize: "32px" }}>📸</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "14px", color: "#202223" }}>Instagram</div>
                <div style={{ fontSize: "12px", color: "#6d7175" }}>
                  {s?.instagramConnected ? `Connected: @${s.instagramHandle}` : "Not connected"}
                </div>
              </div>
              <span style={{
                fontSize: "12px", fontWeight: 600, padding: "4px 12px", borderRadius: "99px",
                background: s?.instagramConnected ? "#e3f1eb" : "#f6f6f7",
                color: s?.instagramConnected ? "#008060" : "#6d7175",
              }}>
                {s?.instagramConnected ? "✓ Connected" : "Not connected"}
              </span>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Instagram handle</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="text" value={instagramHandle} onChange={e => setInstagramHandle(e.target.value)} placeholder="@yourhandle" style={{ ...inputStyle, maxWidth: "240px" }} />
                <button onClick={() => handleConnect("instagram", instagramHandle)} disabled={!instagramHandle || isSaving}
                  style={{ padding: "8px 16px", background: instagramHandle ? "#e1306c" : "#c9cccf", color: "white", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: 600, cursor: instagramHandle ? "pointer" : "not-allowed" }}>
                  Connect
                </button>
              </div>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Import by Reel URL</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="text" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://instagram.com/reel/..." style={inputStyle} />
                <button onClick={() => handleImport("instagram")} disabled={!videoUrl || isSaving}
                  style={{ padding: "8px 16px", background: videoUrl ? "#e1306c" : "#c9cccf", color: "white", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: 600, cursor: videoUrl ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>
                  {isSaving ? "Importing..." : "Import"}
                </button>
              </div>
            </div>
          </div>
        </s-section>
      )}

      {/* Upload */}
      {activeTab === "upload" && (
        <s-section heading="Upload Video" description="Upload your own video files directly.">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ border: "2px dashed #c9cccf", borderRadius: "10px", padding: "48px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>⬆️</div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "#202223", marginBottom: "8px" }}>Upload a video</div>
              <div style={{ fontSize: "13px", color: "#6d7175", marginBottom: "16px" }}>MP4, MOV up to 100MB. 9:16 recommended for best display.</div>
              <input type="file" accept="video/*" style={{ display: "none" }} id="video-upload" />
              <label htmlFor="video-upload" style={{ padding: "10px 24px", background: "#5C6AC4", color: "white", borderRadius: "7px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                Choose Video File
              </label>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Or enter video URL</label>
              <input type="text" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://cdn.example.com/video.mp4" style={inputStyle} />
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Video title</label>
              <input type="text" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} placeholder="Summer Collection 2025" style={inputStyle} />
            </div>

            <div style={rowStyle}>
              <div><div style={labelStyle}>Auto-publish after import</div><div style={hintStyle}>Make video live immediately</div></div>
              <label style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={autoPublish} onChange={e => setAutoPublish(e.target.checked)} style={{ display: "none" }} />
                <div style={{ ...toggleStyle, background: autoPublish ? "#008060" : "#c9cccf" }}><div style={{ ...toggleDotStyle, transform: autoPublish ? "translateX(20px)" : "translateX(2px)" }} /></div>
              </label>
            </div>

            <button onClick={() => handleImport("upload")} disabled={!videoUrl || isSaving}
              style={{ padding: "10px 24px", background: videoUrl ? "#5C6AC4" : "#c9cccf", color: "white", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: 600, cursor: videoUrl ? "pointer" : "not-allowed", alignSelf: "flex-start" }}>
              {isSaving ? "Uploading..." : "⬆️ Upload Video"}
            </button>
          </div>
        </s-section>
      )}

      {/* History */}
      {activeTab === "history" && (
        <s-section heading="Import History">
          {recentImports.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#6d7175", fontSize: "13px" }}>
              No imports yet. Import from TikTok, Instagram, or upload your own videos.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e1e3e5" }}>
                    {["Title", "Source", "Views", "Conversions", "Status", "Imported"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: "#6d7175", fontSize: "12px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentImports.map(v => (
                    <tr key={v.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
                      <td style={{ padding: "12px", fontWeight: 600 }}>{v.title || "Untitled"}</td>
                      <td style={{ padding: "12px", textTransform: "capitalize" }}>{v.source}</td>
                      <td style={{ padding: "12px" }}>{v.views}</td>
                      <td style={{ padding: "12px" }}>{v.conversions}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ padding: "3px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: 600, background: v.published ? "#e3f1eb" : "#fff4e5", color: v.published ? "#008060" : "#b5731d" }}>
                          {v.published ? "Live" : "Draft"}
                        </span>
                      </td>
                      <td style={{ padding: "12px", color: "#6d7175" }}>{new Date(v.createdAt).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </s-section>
      )}

      <s-section slot="aside" heading="💡 Import Tips">
        <s-paragraph>9:16 vertical videos perform 3× better than horizontal on mobile.</s-paragraph>
        <s-paragraph>Tag products in videos after importing for shoppable functionality.</s-paragraph>
        <s-paragraph>UGC (customer videos) convert better than brand-made content.</s-paragraph>
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
