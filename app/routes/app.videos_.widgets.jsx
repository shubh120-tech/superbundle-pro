import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  let widgets = [];
  let videos = [];
  try {
    [widgets, videos] = await Promise.all([
      db.videoWidget.findMany({ where: { shop: session.shop }, orderBy: { createdAt: "desc" } }),
      db.video.findMany({ where: { shop: session.shop, published: true }, select: { id: true, title: true, thumbnailUrl: true } }),
    ]);
  } catch (e) { console.warn("DB error:", e.message); }
  return { widgets, videos };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const data = Object.fromEntries(formData);

  if (intent === "create" || intent === "update") {
    const payload = {
      name: data.name || "New Widget",
      widgetType: data.widgetType || "carousel",
      placement: data.placement || "product_page",
      videoIds: data.videoIds || "[]",
      title: data.title || "",
      maxVideos: parseInt(data.maxVideos || 10),
      autoplay: data.autoplay === "true",
      published: data.published === "true",
    };
    try {
      if (intent === "create") {
        await db.videoWidget.create({ data: { shop: session.shop, ...payload } });
      } else {
        await db.videoWidget.update({ where: { id: parseInt(data.widgetId) }, data: payload });
      }
    } catch (e) { return { success: false, message: e.message }; }
    return { success: true };
  }

  if (intent === "delete") {
    try { await db.videoWidget.delete({ where: { id: parseInt(data.widgetId) } }); }
    catch (e) { return { success: false, message: e.message }; }
    return { success: true };
  }

  return { success: false };
};

export default function VideoWidgets() {
  const { widgets, videos } = useLoaderData();
  const fetcher = useFetcher();

  const [showForm, setShowForm] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [form, setForm] = useState({ name: "", widgetType: "carousel", placement: "product_page", title: "", maxVideos: 10, autoplay: true, published: true, videoIds: [] });

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const openCreate = () => { setEditingWidget(null); setForm({ name: "", widgetType: "carousel", placement: "product_page", title: "", maxVideos: 10, autoplay: true, published: true, videoIds: [] }); setShowForm(true); };
  const openEdit = (w) => { setEditingWidget(w); setForm({ ...w, videoIds: JSON.parse(w.videoIds || "[]") }); setShowForm(true); };

  const handleSubmit = () => {
    fetcher.submit({
      intent: editingWidget ? "update" : "create",
      widgetId: editingWidget?.id,
      ...form,
      videoIds: JSON.stringify(form.videoIds),
      autoplay: String(form.autoplay),
      published: String(form.published),
    }, { method: "POST" });
    setShowForm(false);
  };

  const widgetTypeIcons = { carousel: "🎠", story: "📱", grid: "📐", floating: "💬" };
  const placementLabels = { product_page: "Product Page", homepage: "Homepage", collection: "Collection Page", cart: "Cart" };

  return (
    <s-page heading="Video Widgets">
      <s-button slot="primary-action" onClick={openCreate}>+ Create Widget</s-button>
      {fetcher.data?.success === false && <s-banner tone="critical">{fetcher.data.message}</s-banner>}
      {fetcher.data?.success && !showForm && <s-banner tone="success">Widget saved!</s-banner>}

      {/* Widget Form */}
      {showForm && (
        <s-section heading={editingWidget ? "Edit Widget" : "Create New Widget"}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Widget name</label>
                <input type="text" value={form.name} onChange={e => updateForm("name", e.target.value)} placeholder="Product Page Carousel" style={inputStyle} />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Placement</label>
                <select value={form.placement} onChange={e => updateForm("placement", e.target.value)} style={inputStyle}>
                  {Object.entries(placementLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Widget type</label>
              <div style={{ display: "flex", gap: "10px" }}>
                {["carousel", "story", "grid", "floating"].map(t => (
                  <button key={t} onClick={() => updateForm("widgetType", t)} style={{
                    padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px",
                    border: `2px solid ${form.widgetType === t ? "#5C6AC4" : "#e1e3e5"}`,
                    background: form.widgetType === t ? "#5C6AC408" : "white",
                    color: form.widgetType === t ? "#5C6AC4" : "#6d7175",
                    fontWeight: form.widgetType === t ? 600 : 400,
                  }}>
                    {widgetTypeIcons[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Widget title (optional)</label>
                <input type="text" value={form.title} onChange={e => updateForm("title", e.target.value)} placeholder="Watch in Action" style={inputStyle} />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Max videos to show</label>
                <select value={form.maxVideos} onChange={e => updateForm("maxVideos", Number(e.target.value))} style={inputStyle}>
                  {[3, 5, 8, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Select videos ({form.videoIds.length} selected)</label>
              {videos.length === 0 ? (
                <div style={{ padding: "16px", background: "#f6f6f7", borderRadius: "8px", fontSize: "13px", color: "#6d7175" }}>
                  No published videos yet. <a href="/app/videos/import" style={{ color: "#2c6ecb" }}>Import videos first →</a>
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {videos.map(v => {
                    const selected = form.videoIds.includes(v.id);
                    return (
                      <div key={v.id} onClick={() => updateForm("videoIds", selected ? form.videoIds.filter(x => x !== v.id) : [...form.videoIds, v.id])} style={{
                        display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px",
                        border: `2px solid ${selected ? "#5C6AC4" : "#e1e3e5"}`,
                        borderRadius: "7px", cursor: "pointer",
                        background: selected ? "#5C6AC408" : "white",
                      }}>
                        {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" style={{ width: 24, height: 24, borderRadius: 3, objectFit: "cover" }} />}
                        <span style={{ fontSize: "12px", fontWeight: selected ? 600 : 400, color: selected ? "#5C6AC4" : "#202223" }}>{v.title || `Video ${v.id}`}</span>
                        {selected && <span style={{ color: "#5C6AC4", fontSize: "12px" }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "16px" }}>
              {[
                { label: "Autoplay", value: form.autoplay, key: "autoplay" },
                { label: "Published", value: form.published, key: "published" },
              ].map(item => (
                <div key={item.key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <label style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={item.value} onChange={e => updateForm(item.key, e.target.checked)} style={{ display: "none" }} />
                    <div style={{ ...toggleStyle, background: item.value ? "#5C6AC4" : "#c9cccf" }}><div style={{ ...toggleDotStyle, transform: item.value ? "translateX(20px)" : "translateX(2px)" }} /></div>
                  </label>
                  <span style={{ fontSize: "13px", color: "#202223" }}>{item.label}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleSubmit} style={{ padding: "9px 20px", background: "#5C6AC4", color: "white", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                {editingWidget ? "Update Widget" : "Create Widget"}
              </button>
              <button onClick={() => setShowForm(false)} style={{ padding: "9px 20px", background: "#f6f6f7", color: "#6d7175", border: "1px solid #e1e3e5", borderRadius: "7px", fontSize: "13px", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </s-section>
      )}

      {/* Widget List */}
      <s-section heading={`Your Widgets (${widgets.length})`}>
        {widgets.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>📱</div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "#202223", marginBottom: "8px" }}>No widgets yet</div>
            <div style={{ fontSize: "13px", color: "#6d7175", marginBottom: "16px" }}>Create a widget to display shoppable videos on your store.</div>
            <button onClick={openCreate} style={{ padding: "10px 20px", background: "#5C6AC4", color: "white", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              Create First Widget
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {widgets.map(w => (
              <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", border: "1px solid #e1e3e5", borderRadius: "10px", background: w.published ? "white" : "#f6f6f7" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "24px" }}>{widgetTypeIcons[w.widgetType]}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px", color: "#202223" }}>{w.name}</div>
                    <div style={{ fontSize: "12px", color: "#6d7175" }}>{placementLabels[w.placement]} · {w.widgetType} · {JSON.parse(w.videoIds || "[]").length} videos</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "99px", background: w.published ? "#e3f1eb" : "#f6f6f7", color: w.published ? "#008060" : "#6d7175" }}>
                    {w.published ? "Live" : "Draft"}
                  </span>
                  <button onClick={() => openEdit(w)} style={{ padding: "6px 14px", background: "#f6f6f7", border: "1px solid #e1e3e5", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "#202223" }}>Edit</button>
                  <button onClick={() => fetcher.submit({ intent: "delete", widgetId: w.id }, { method: "POST" })} style={{ padding: "6px 10px", background: "#fbe9e7", border: "none", borderRadius: "6px", cursor: "pointer", color: "#d72c0d", fontSize: "14px" }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </s-section>

      <s-section slot="aside" heading="📍 Placement Guide">
        {Object.entries(placementLabels).map(([k, v]) => (
          <div key={k} style={{ padding: "8px 0", borderBottom: "1px solid #f1f1f1" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#202223" }}>{v}</div>
            <div style={{ fontSize: "12px", color: "#6d7175" }}>
              {k === "product_page" ? "Shows below product description" :
                k === "homepage" ? "Featured section on homepage" :
                  k === "collection" ? "Above collection grid" : "Floating button on all pages"}
            </div>
          </div>
        ))}
      </s-section>
    </s-page>
  );
}

const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #c9cccf", fontSize: "13px", outline: "none", boxSizing: "border-box", background: "white" };
const fieldGroupStyle = { display: "flex", flexDirection: "column", gap: "4px" };
const labelStyle = { fontSize: "13px", fontWeight: "600", color: "#202223", display: "block" };
const toggleStyle = { width: "44px", height: "24px", borderRadius: "99px", position: "relative", transition: "background 0.2s", cursor: "pointer" };
const toggleDotStyle = { position: "absolute", top: "2px", width: "20px", height: "20px", borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "transform 0.2s" };

export const headers = (headersArgs) => boundary.headers(headersArgs);
