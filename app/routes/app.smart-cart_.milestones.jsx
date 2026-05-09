import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  let settings = null;
  try {
    settings = await db.smartCartSettings.findUnique({ where: { shop: session.shop } });
  } catch (e) { console.warn("DB error:", e.message); }
  return { settings };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  try {
    await db.smartCartSettings.upsert({
      where: { shop: session.shop },
      update: { milestonesEnabled: data.milestonesEnabled === "true", milestones: data.milestones || "[]" },
      create: { shop: session.shop, milestonesEnabled: data.milestonesEnabled === "true", milestones: data.milestones || "[]" },
    });
  } catch (e) { return { success: false, message: e.message }; }
  return { success: true };
};

const DEFAULT_MILESTONES = [
  { id: 1, threshold: 500, type: "gift", reward: "Free Gift 🎁", description: "Mystery gift added to order", enabled: true },
  { id: 2, threshold: 999, type: "discount", reward: "10% OFF 🏷️", description: "Discount applied at checkout", enabled: true },
  { id: 3, threshold: 1999, type: "shipping", reward: "Free Express Shipping ⚡", description: "Delivered in 1-2 days", enabled: true },
];

export default function MilestonesPage() {
  const { settings: s } = useLoaderData();
  const fetcher = useFetcher();
  const isSaving = fetcher.state === "submitting";

  const [milestonesEnabled, setMilestonesEnabled] = useState(s?.milestonesEnabled ?? true);
  const [milestones, setMilestones] = useState(() => {
    try { return JSON.parse(s?.milestones ?? "[]").length > 0 ? JSON.parse(s.milestones) : DEFAULT_MILESTONES; }
    catch { return DEFAULT_MILESTONES; }
  });
  const [previewCart, setPreviewCart] = useState(350);

  const addMilestone = () => {
    setMilestones(prev => [...prev, {
      id: Date.now(), threshold: 0, type: "gift",
      reward: "New Reward", description: "", enabled: true,
    }]);
  };

  const updateMilestone = (id, field, value) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const removeMilestone = (id) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
  };

  const handleSave = () => {
    fetcher.submit({
      milestonesEnabled: String(milestonesEnabled),
      milestones: JSON.stringify(milestones),
    }, { method: "POST" });
  };

  const sortedMilestones = [...milestones].sort((a, b) => a.threshold - b.threshold);

  return (
    <s-page heading="Milestone Rewards">
      <s-button slot="primary-action" onClick={handleSave} {...(isSaving ? { loading: true } : {})}>
        {isSaving ? "Saving..." : "Save Settings"}
      </s-button>
      {fetcher.data?.success && <s-banner tone="success">Milestone settings saved!</s-banner>}

      <s-section heading="Milestone Settings">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={rowStyle}>
            <div><div style={labelStyle}>Enable milestone rewards</div><div style={hintStyle}>Show reward unlocks as customers add items to cart</div></div>
            <label style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={milestonesEnabled} onChange={e => setMilestonesEnabled(e.target.checked)} style={{ display: "none" }} />
              <div style={{ ...toggleStyle, background: milestonesEnabled ? "#008060" : "#c9cccf" }}><div style={{ ...toggleDotStyle, transform: milestonesEnabled ? "translateX(20px)" : "translateX(2px)" }} /></div>
            </label>
          </div>
        </div>
      </s-section>

      <s-section heading="Configure Milestones">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {milestones.map((m, idx) => (
            <div key={m.id} style={{
              border: `1px solid ${m.enabled ? "#008060" : "#e1e3e5"}`,
              borderRadius: "10px", padding: "16px",
              background: m.enabled ? "#f1f8f500" : "#f6f6f7",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#202223" }}>Milestone {idx + 1}</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <label style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={m.enabled} onChange={e => updateMilestone(m.id, "enabled", e.target.checked)} style={{ display: "none" }} />
                    <div style={{ ...toggleStyle, background: m.enabled ? "#008060" : "#c9cccf" }}><div style={{ ...toggleDotStyle, transform: m.enabled ? "translateX(20px)" : "translateX(2px)" }} /></div>
                  </label>
                  <button onClick={() => removeMilestone(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#d72c0d", fontSize: "16px" }}>🗑</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: "12px" }}>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Cart value (₹)</label>
                  <input type="number" value={m.threshold} onChange={e => updateMilestone(m.id, "threshold", Number(e.target.value))} style={inputStyle} />
                </div>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Reward type</label>
                  <select value={m.type} onChange={e => updateMilestone(m.id, "type", e.target.value)} style={inputStyle}>
                    <option value="gift">Free Gift 🎁</option>
                    <option value="discount">Discount 🏷️</option>
                    <option value="shipping">Free Shipping 🚚</option>
                    <option value="points">Bonus Points ⭐</option>
                  </select>
                </div>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Reward label</label>
                  <input type="text" value={m.reward} onChange={e => updateMilestone(m.id, "reward", e.target.value)} style={inputStyle} />
                </div>
                <div style={{ gridColumn: "1 / -1", ...fieldGroupStyle }}>
                  <label style={labelStyle}>Description</label>
                  <input type="text" value={m.description} onChange={e => updateMilestone(m.id, "description", e.target.value)} placeholder="e.g. Mystery gift added to your order" style={inputStyle} />
                </div>
              </div>
            </div>
          ))}

          <button onClick={addMilestone} style={{
            padding: "10px", border: "2px dashed #c9cccf", borderRadius: "10px",
            background: "none", cursor: "pointer", fontSize: "13px",
            color: "#6d7175", fontWeight: 600,
          }}>
            + Add Milestone
          </button>
        </div>
      </s-section>

      {/* Live Preview */}
      <s-section heading="Live Preview">
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Simulate cart value: ₹{previewCart}</label>
          <input type="range" min={0} max={2500} value={previewCart} onChange={e => setPreviewCart(Number(e.target.value))}
            style={{ width: "300px" }} />
        </div>
        <div style={{ background: "#f6f6f7", borderRadius: "10px", padding: "16px", maxWidth: "400px", marginTop: "12px", border: "1px solid #e1e3e5" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#202223", marginBottom: "12px" }}>🏆 Milestone Rewards</div>
          {sortedMilestones.filter(m => m.enabled).map((m, i) => {
            const unlocked = previewCart >= m.threshold;
            const isNext = !unlocked && sortedMilestones.filter(m => m.enabled).findIndex(x => previewCart < x.threshold) === i;
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
                  background: unlocked ? "#008060" : isNext ? "#f4a423" : "#e1e3e5",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px", color: "white", fontWeight: 700,
                }}>
                  {unlocked ? "✓" : i + 1}
                </div>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: unlocked ? "#008060" : "#202223" }}>{m.reward}</div>
                  <div style={{ fontSize: "11px", color: "#6d7175" }}>
                    {unlocked ? "✅ Unlocked!" : isNext ? `Add ₹${m.threshold - previewCart} more` : `At ₹${m.threshold}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </s-section>

      <s-section slot="aside" heading="💡 Tips">
        <s-paragraph>3 milestones is the sweet spot — too many overwhelms customers.</s-paragraph>
        <s-paragraph>Set first milestone at 10-20% above your average order value.</s-paragraph>
        <s-paragraph>Free shipping as a milestone reward converts better than discounts.</s-paragraph>
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
