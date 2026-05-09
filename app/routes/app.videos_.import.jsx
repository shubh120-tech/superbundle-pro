import { useState, useRef } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  let recentImports = [];
  try {
    recentImports = await db.video.findMany({
      where: { shop: session.shop },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } catch (e) { console.warn("DB error:", e.message); }
  return { recentImports };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "import_youtube") {
    const urls = (formData.get("urls") || "").split("\n").map(u => u.trim()).filter(Boolean);
    const autoPublish = formData.get("autoPublish") === "true";
    if (urls.length === 0) return { success: false, message: "Please enter at least one YouTube URL." };

    const videos = urls.map(url => {
      const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      const thumbnailUrl = ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg` : "";
      const title = formData.get("title") || (url.includes("shorts") ? "YouTube Short" : "YouTube Video");
      return { shop: session.shop, title, videoUrl: url, thumbnailUrl, source: "youtube", published: autoPublish, productIds: "[]" };
    });

    try {
      await db.video.createMany({ data: videos });
    } catch (e) { return { success: false, message: e.message }; }
    return { success: true, message: `${videos.length} YouTube video${videos.length > 1 ? "s" : ""} imported!` };
  }

  if (intent === "import_upload") {
    const videoUrl = formData.get("videoUrl");
    const title = formData.get("title") || "Uploaded Video";
    const autoPublish = formData.get("autoPublish") === "true";
    if (!videoUrl) return { success: false, message: "Please enter a video URL." };
    try {
      await db.video.create({
        data: { shop: session.shop, title, videoUrl, thumbnailUrl: "", source: "upload", published: autoPublish, productIds: "[]" },
      });
    } catch (e) { return { success: false, message: e.message }; }
    return { success: true, message: "Video uploaded successfully!" };
  }

  if (intent === "delete") {
    try { await db.video.delete({ where: { id: parseInt(formData.get("videoId")) } }); }
    catch (e) { return { success: false, message: e.message }; }
    return { success: true };
  }

  if (intent === "toggle_publish") {
    const videoId = parseInt(formData.get("videoId"));
    const published = formData.get("published") === "true";
    try { await db.video.update({ where: { id: videoId }, data: { published: !published } }); }
    catch (e) { return { success: false, message: e.message }; }
    return { success: true };
  }

  return { success: false, message: "Unknown intent" };
};

export default function VideoImport() {
  const { recentImports } = useLoaderData();
  const fetcher = useFetcher();
  const isSaving = fetcher.state === "submitting";
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState("youtube");
  const [ytUrls, setYtUrls] = useState("");
  const [ytTitle, setYtTitle] = useState("");
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [autoPublish, setAutoPublish] = useState(true);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
  };

  const handleYouTubeImport = () => {
    if (!ytUrls.trim()) return;
    fetcher.submit({ intent: "import_youtube", urls: ytUrls, title: ytTitle, autoPublish: String(autoPublish) }, { method: "POST" });
    setYtUrls("");
    setYtTitle("");
  };

  const handleUploadImport = () => {
    if (!uploadUrl.trim() && !uploadedFile) return;
    fetcher.submit({ intent: "import_upload", videoUrl: uploadUrl || previewUrl, title: uploadTitle, autoPublish: String(autoPublish) }, { method: "POST" });
    setUploadUrl("");
    setUploadTitle("");
    setUploadedFile(null);
    setPreviewUrl("");
  };

  // Live YouTube preview
  const getYtThumb = (url) => {
    const match = url.trim().split("\n")[0].match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
  };
  const ytThumb = ytUrls ? getYtThumb(ytUrls) : null;
  const ytUrlCount = ytUrls.split("\n").filter(u => u.trim()).length;

  return (
    <s-page heading="Import Videos">
      {fetcher.data?.success && <s-banner tone="success">{fetcher.data.message}</s-banner>}
      {fetcher.data?.success === false && <s-banner tone="critical">{fetcher.data.message}</s-banner>}

      {/* Tabs */}
      <s-section>
        <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid #e1e3e5" }}>
          {[["youtube", "▶️ YouTube"], ["upload", "⬆️ Device Upload"], ["history", "📋 All Videos"]].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "10px 18px", border: "none", cursor: "pointer", fontSize: "13px",
              fontWeight: activeTab === tab ? "600" : "400", background: "transparent",
              color: activeTab === tab ? "#202223" : "#6d7175",
              borderBottom: activeTab === tab ? "2px solid #202223" : "2px solid transparent",
              marginBottom: "-1px",
            }}>{label}</button>
          ))}
        </div>
      </s-section>

      {/* ── YouTube Tab ── */}
      {activeTab === "youtube" && (
        <s-section heading="Import from YouTube" description="Add YouTube videos or Shorts. Supports single or multiple URLs at once.">
          <div style={{ display: "flex", gap: "24px" }}>

            {/* Left: form */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ padding: "12px 14px", background: "#f0f7ff", border: "1px solid #b3d4ff", borderRadius: "8px", fontSize: "13px", color: "#0c4a8f" }}>
                ✅ Supports: <strong>youtube.com/watch?v=</strong> · <strong>youtu.be/</strong> · <strong>youtube.com/shorts/</strong>
              </div>

              <div style={fieldGroupStyle}>
                <label style={labelStyle}>YouTube URL(s) <span style={{ color: "#6d7175", fontWeight: 400 }}>— one per line for bulk import</span></label>
                <textarea
                  value={ytUrls}
                  onChange={e => setYtUrls(e.target.value)}
                  placeholder={"https://youtube.com/watch?v=dQw4w9WgXcQ\nhttps://youtube.com/shorts/abc123\nhttps://youtu.be/xyz456"}
                  rows={5}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: "12px" }}
                />
                {ytUrlCount > 1 && (
                  <div style={{ fontSize: "12px", color: "#008060", fontWeight: 600 }}>✓ {ytUrlCount} URLs detected — will import all</div>
                )}
              </div>

              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Title <span style={{ color: "#6d7175", fontWeight: 400 }}>(optional — auto-detected for single URL)</span></label>
                <input type="text" value={ytTitle} onChange={e => setYtTitle(e.target.value)} placeholder="e.g. Product Demo" style={inputStyle} />
              </div>

              <div style={rowStyle}>
                <div><div style={labelStyle}>Auto-publish after import</div><div style={hintStyle}>Make videos live immediately</div></div>
                <label style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={autoPublish} onChange={e => setAutoPublish(e.target.checked)} style={{ display: "none" }} />
                  <div style={{ ...toggleStyle, background: autoPublish ? "#008060" : "#c9cccf" }}><div style={{ ...toggleDotStyle, transform: autoPublish ? "translateX(20px)" : "translateX(2px)" }} /></div>
                </label>
              </div>

              <button
                onClick={handleYouTubeImport}
                disabled={!ytUrls.trim() || isSaving}
                style={{ padding: "11px 24px", background: ytUrls.trim() ? "#dc2626" : "#c9cccf", color: "white", border: "none", borderRadius: "7px", fontSize: "14px", fontWeight: 700, cursor: ytUrls.trim() ? "pointer" : "not-allowed", alignSelf: "flex-start" }}
              >
                {isSaving ? "Importing..." : `▶️ Import ${ytUrlCount > 1 ? `${ytUrlCount} Videos` : "Video"}`}
              </button>
            </div>

            {/* Right: preview */}
            <div style={{ width: "220px", flexShrink: 0 }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Preview</label>
                <div style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid #e1e3e5", background: "#1a1a2e", aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {ytThumb ? (
                    <div style={{ position: "relative", width: "100%" }}>
                      <img src={ytThumb} alt="YouTube thumbnail" style={{ width: "100%", display: "block" }} />
                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "rgba(0,0,0,0.7)", borderRadius: "50%", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>▶️</div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>
                      <div style={{ fontSize: "32px", marginBottom: "8px" }}>▶️</div>
                      Paste a URL to preview
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </s-section>
      )}

      {/* ── Upload Tab ── */}
      {activeTab === "upload" && (
        <s-section heading="Upload from Device" description="Upload MP4 videos directly from your computer or phone.">
          <div style={{ display: "flex", gap: "24px" }}>

            {/* Left: form */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) { setUploadedFile(file); setPreviewUrl(URL.createObjectURL(file)); setUploadTitle(file.name.replace(/\.[^/.]+$/, "")); }}}
                style={{
                  border: `2px dashed ${uploadedFile ? "#008060" : "#c9cccf"}`,
                  borderRadius: "10px", padding: "36px", textAlign: "center",
                  cursor: "pointer", background: uploadedFile ? "#f1f8f5" : "#fafafa",
                  transition: "all 0.2s",
                }}
              >
                <input ref={fileInputRef} type="file" accept="video/mp4,video/quicktime,video/avi,video/webm" style={{ display: "none" }} onChange={handleFileChange} />
                {uploadedFile ? (
                  <>
                    <div style={{ fontSize: "36px", marginBottom: "8px" }}>✅</div>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "#202223" }}>{uploadedFile.name}</div>
                    <div style={{ fontSize: "12px", color: "#6d7175", marginTop: "4px" }}>{(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB · Click to change</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: "36px", marginBottom: "10px" }}>⬆️</div>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "#202223", marginBottom: "4px" }}>Click or drag video here</div>
                    <div style={{ fontSize: "12px", color: "#6d7175" }}>MP4, MOV, AVI, WebM — max 100MB</div>
                  </>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ flex: 1, height: "1px", background: "#e1e3e5" }} />
                <span style={{ fontSize: "12px", color: "#6d7175" }}>OR</span>
                <div style={{ flex: 1, height: "1px", background: "#e1e3e5" }} />
              </div>

              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Direct video URL (MP4/CDN)</label>
                <input
                  type="text"
                  value={uploadUrl}
                  onChange={e => { setUploadUrl(e.target.value); setUploadedFile(null); setPreviewUrl(""); }}
                  placeholder="https://cdn.example.com/video.mp4"
                  style={inputStyle}
                  disabled={!!uploadedFile}
                />
                <div style={hintStyle}>Host on Cloudinary, AWS S3, or any CDN</div>
              </div>

              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Video title</label>
                <input type="text" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="e.g. Summer Collection 2025" style={inputStyle} />
              </div>

              <div style={rowStyle}>
                <div><div style={labelStyle}>Auto-publish after upload</div><div style={hintStyle}>Make video live immediately</div></div>
                <label style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={autoPublish} onChange={e => setAutoPublish(e.target.checked)} style={{ display: "none" }} />
                  <div style={{ ...toggleStyle, background: autoPublish ? "#008060" : "#c9cccf" }}><div style={{ ...toggleDotStyle, transform: autoPublish ? "translateX(20px)" : "translateX(2px)" }} /></div>
                </label>
              </div>

              <button
                onClick={handleUploadImport}
                disabled={(!uploadUrl.trim() && !uploadedFile) || isSaving}
                style={{ padding: "11px 24px", background: (uploadUrl.trim() || uploadedFile) ? "#5C6AC4" : "#c9cccf", color: "white", border: "none", borderRadius: "7px", fontSize: "14px", fontWeight: 700, cursor: (uploadUrl.trim() || uploadedFile) ? "pointer" : "not-allowed", alignSelf: "flex-start" }}
              >
                {isSaving ? "Uploading..." : "⬆️ Upload Video"}
              </button>

              <div style={{ padding: "12px 14px", background: "#fff9f0", border: "1px solid #f4a423", borderRadius: "8px", fontSize: "12px", color: "#b5731d" }}>
                💡 <strong>Tip:</strong> For best quality use 9:16 vertical MP4 under 30MB. Upload to <a href="https://cloudinary.com" target="_blank" rel="noreferrer" style={{ color: "#b5731d" }}>Cloudinary</a> (free) and paste the URL above.
              </div>
            </div>

            {/* Right: preview */}
            <div style={{ width: "220px", flexShrink: 0 }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Preview</label>
                {previewUrl ? (
                  <video src={previewUrl} controls style={{ width: "100%", borderRadius: "10px", border: "1px solid #e1e3e5" }} />
                ) : (
                  <div style={{ borderRadius: "10px", border: "1px solid #e1e3e5", background: "#1a1a2e", aspectRatio: "9/16", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>
                      <div style={{ fontSize: "32px", marginBottom: "8px" }}>🎥</div>
                      Upload to preview
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </s-section>
      )}

      {/* ── History Tab ── */}
      {activeTab === "history" && (
        <s-section heading={`All Videos (${recentImports.length})`}>
          {recentImports.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎥</div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "#202223", marginBottom: "6px" }}>No videos yet</div>
              <div style={{ fontSize: "13px", color: "#6d7175" }}>Import from YouTube or upload from your device.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
              {recentImports.map(v => (
                <div key={v.id} style={{ border: "1px solid #e1e3e5", borderRadius: "10px", overflow: "hidden", background: "white" }}>
                  <div style={{ position: "relative", paddingTop: "56%", background: "#1a1a2e" }}>
                    {v.thumbnailUrl ? (
                      <img src={v.thumbnailUrl} alt={v.title} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: "28px" }}>
                        {v.source === "youtube" ? "▶️" : "🎥"}
                      </div>
                    )}
                    <span style={{ position: "absolute", top: "6px", left: "6px", fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "99px", background: "rgba(0,0,0,0.6)", color: "white", textTransform: "capitalize" }}>
                      {v.source === "youtube" ? "▶️ YouTube" : "⬆️ Upload"}
                    </span>
                    <span style={{ position: "absolute", top: "6px", right: "6px", fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "99px", background: v.published ? "#008060" : "#f4a423", color: "white" }}>
                      {v.published ? "Live" : "Draft"}
                    </span>
                  </div>
                  <div style={{ padding: "10px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#202223", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.title || "Untitled"}
                    </div>
                    <div style={{ fontSize: "11px", color: "#6d7175", marginBottom: "8px" }}>
                      👁 {v.views} · {new Date(v.createdAt).toLocaleDateString("en-IN")}
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => fetcher.submit({ intent: "toggle_publish", videoId: v.id, published: String(v.published) }, { method: "POST" })}
                        style={{ flex: 1, padding: "5px", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "11px", fontWeight: 600, background: v.published ? "#fff4e5" : "#e3f1eb", color: v.published ? "#b5731d" : "#008060" }}
                      >
                        {v.published ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        onClick={() => fetcher.submit({ intent: "delete", videoId: v.id }, { method: "POST" })}
                        style={{ padding: "5px 8px", border: "none", borderRadius: "5px", cursor: "pointer", background: "#fbe9e7", color: "#d72c0d", fontSize: "12px" }}
                      >🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </s-section>
      )}

      <s-section slot="aside" heading="💡 Tips">
        <s-paragraph>YouTube Shorts are vertical and mobile-optimized — perfect for product demos.</s-paragraph>
        <s-paragraph>Paste multiple YouTube URLs at once to bulk import an entire playlist.</s-paragraph>
        <s-paragraph>For device uploads — host on Cloudinary (free tier) and paste the MP4 URL.</s-paragraph>
        <s-paragraph>Tag products in videos after importing for the full shoppable experience.</s-paragraph>
      </s-section>

      <s-section slot="aside" heading="📊 Stats">
        {[
          { label: "Total", value: recentImports.length },
          { label: "Published", value: recentImports.filter(v => v.published).length },
          { label: "Draft", value: recentImports.filter(v => !v.published).length },
          { label: "YouTube", value: recentImports.filter(v => v.source === "youtube").length },
          { label: "Uploaded", value: recentImports.filter(v => v.source === "upload").length },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f1f1f1", fontSize: "13px" }}>
            <span style={{ color: "#6d7175" }}>{s.label}</span>
            <span style={{ fontWeight: 600 }}>{s.value}</span>
          </div>
        ))}
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