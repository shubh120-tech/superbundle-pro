import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  let settings = null;
  let products = [];
  try {
    settings = await db.smartCartSettings.findUnique({ where: { shop: session.shop } });
    const res = await admin.graphql(`
      query { products(first: 20) { edges { node { id title variants(first: 1) { edges { node { id price } } } featuredImage { url } } } } }
    `);
    const data = await res.json();
    products = data?.data?.products?.edges?.map(e => ({
      id: e.node.id,
      title: e.node.title,
      variantId: e.node.variants.edges[0]?.node.id,
      price: e.node.variants.edges[0]?.node.price,
      image: e.node.featuredImage?.url,
    })) ?? [];
  } catch (e) { console.warn("Error:", e.message); }
  return { settings, products };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  try {
    await db.smartCartSettings.upsert({
      where: { shop: session.shop },
      update: {
        upsellEnabled: data.upsellEnabled === "true",
        upsellTitle: data.upsellTitle || "You might also like",
        upsellMaxProducts: parseInt(data.upsellMaxProducts || 3),
        upsellProductIds: data.upsellProductIds || "[]",
        freebieEnabled: data.freebieEnabled === "true",
        freebieThreshold: parseFloat(data.freebieThreshold || 999),
        freebieProductIds: data.freebieProductIds || "[]",
      },
      create: {
        shop: session.shop,
        upsellEnabled: data.upsellEnabled === "true",
        upsellTitle: data.upsellTitle || "You might also like",
        upsellMaxProducts: parseInt(data.upsellMaxProducts || 3),
        upsellProductIds: data.upsellProductIds || "[]",
        freebieEnabled: data.freebieEnabled === "true",
        freebieThreshold: parseFloat(data.freebieThreshold || 999),
        freebieProductIds: data.freebieProductIds || "[]",
      },
    });
  } catch (e) { return { success: false, message: e.message }; }
  return { success: true };
};

export default function UpsellRules() {
  const { settings: s, products } = useLoaderData();
  const fetcher = useFetcher();
  const isSaving = fetcher.state === "submitting";

  const [upsellEnabled, setUpsellEnabled] = useState(s?.upsellEnabled ?? true);
  const [upsellTitle, setUpsellTitle] = useState(s?.upsellTitle ?? "You might also like");
  const [upsellMaxProducts, setUpsellMaxProducts] = useState(s?.upsellMaxProducts ?? 3);
  const [selectedUpsellIds, setSelectedUpsellIds] = useState(() => {
    try { return JSON.parse(s?.upsellProductIds ?? "[]"); } catch { return []; }
  });
  const [freebieEnabled, setFreebieEnabled] = useState(s?.freebieEnabled ?? false);
  const [freebieThreshold, setFreebieThreshold] = useState(s?.freebieThreshold ?? 999);
  const [selectedFreebieIds, setSelectedFreebieIds] = useState(() => {
    try { return JSON.parse(s?.freebieProductIds ?? "[]"); } catch { return []; }
  });
  const [activeTab, setActiveTab] = useState("upsell");

  const toggleProduct = (id, list, setList) => {
    setList(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = () => {
    fetcher.submit({
      upsellEnabled: String(upsellEnabled), upsellTitle,
      upsellMaxProducts, upsellProductIds: JSON.stringify(selectedUpsellIds),
      freebieEnabled: String(freebieEnabled), freebieThreshold,
      freebieProductIds: JSON.stringify(selectedFreebieIds),
    }, { method: "POST" });
  };

  return (
    <s-page heading="Upsell Rules">
      <s-button slot="primary-action" onClick={handleSave} {...(isSaving ? { loading: true } : {})}>
        {isSaving ? "Saving..." : "Save Settings"}
      </s-button>
      {fetcher.data?.success && <s-banner tone="success">Upsell settings saved!</s-banner>}

      <s-section>
        <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid #e1e3e5" }}>
          {["upsell", "freebie"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "10px 16px", border: "none", cursor: "pointer", fontSize: "13px",
              fontWeight: activeTab === tab ? "600" : "400", background: "transparent",
              color: activeTab === tab ? "#202223" : "#6d7175",
              borderBottom: activeTab === tab ? "2px solid #202223" : "2px solid transparent",
              marginBottom: "-1px",
            }}>{tab === "upsell" ? "📈 In-Cart Upsell" : "🎁 Freebie Selector"}</button>
          ))}
        </div>
      </s-section>

      {activeTab === "upsell" && (
        <s-section heading="In-Cart Upsell" description="Show product recommendations inside the cart to increase order value.">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={rowStyle}>
              <div><div style={labelStyle}>Enable in-cart upsell</div><div style={hintStyle}>Show recommended products in cart drawer</div></div>
              <label style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={upsellEnabled} onChange={e => setUpsellEnabled(e.target.checked)} style={{ display: "none" }} />
                <div style={{ ...toggleStyle, background: upsellEnabled ? "#008060" : "#c9cccf" }}><div style={{ ...toggleDotStyle, transform: upsellEnabled ? "translateX(20px)" : "translateX(2px)" }} /></div>
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Section title</label>
                <input type="text" value={upsellTitle} onChange={e => setUpsellTitle(e.target.value)} style={inputStyle} />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Max products to show</label>
                <select value={upsellMaxProducts} onChange={e => setUpsellMaxProducts(Number(e.target.value))} style={inputStyle}>
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Select upsell products ({selectedUpsellIds.length} selected)</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", maxHeight: "320px", overflowY: "auto", padding: "4px" }}>
                {products.map(p => {
                  const selected = selectedUpsellIds.includes(p.variantId);
                  return (
                    <div key={p.id} onClick={() => toggleProduct(p.variantId, selectedUpsellIds, setSelectedUpsellIds)} style={{
                      border: `2px solid ${selected ? "#008060" : "#e1e3e5"}`,
                      borderRadius: "8px", padding: "10px", cursor: "pointer",
                      background: selected ? "#f1f8f5" : "white",
                    }}>
                      {p.image && <img src={p.image} alt={p.title} style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "4px", marginBottom: "6px" }} />}
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#202223", marginBottom: "2px" }}>{p.title}</div>
                      <div style={{ fontSize: "11px", color: "#6d7175" }}>₹{p.price}</div>
                      {selected && <div style={{ fontSize: "11px", color: "#008060", fontWeight: 600, marginTop: "4px" }}>✓ Selected</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </s-section>
      )}

      {activeTab === "freebie" && (
        <s-section heading="Freebie Selector" description="Let customers choose a free gift when they reach a cart value threshold.">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={rowStyle}>
              <div><div style={labelStyle}>Enable freebie selector</div><div style={hintStyle}>Customers choose a free gift at threshold</div></div>
              <label style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={freebieEnabled} onChange={e => setFreebieEnabled(e.target.checked)} style={{ display: "none" }} />
                <div style={{ ...toggleStyle, background: freebieEnabled ? "#008060" : "#c9cccf" }}><div style={{ ...toggleDotStyle, transform: freebieEnabled ? "translateX(20px)" : "translateX(2px)" }} /></div>
              </label>
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Cart value threshold (₹)</label>
              <input type="number" value={freebieThreshold} onChange={e => setFreebieThreshold(Number(e.target.value))} style={{ ...inputStyle, maxWidth: "180px" }} />
              <div style={hintStyle}>Customer must reach this cart value to unlock a free gift</div>
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Select freebie products ({selectedFreebieIds.length} selected)</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                {products.map(p => {
                  const selected = selectedFreebieIds.includes(p.variantId);
                  return (
                    <div key={p.id} onClick={() => toggleProduct(p.variantId, selectedFreebieIds, setSelectedFreebieIds)} style={{
                      border: `2px solid ${selected ? "#f4a423" : "#e1e3e5"}`,
                      borderRadius: "8px", padding: "10px", cursor: "pointer",
                      background: selected ? "#fff9f0" : "white",
                    }}>
                      {p.image && <img src={p.image} alt={p.title} style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "4px", marginBottom: "6px" }} />}
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#202223" }}>{p.title}</div>
                      {selected && <div style={{ fontSize: "11px", color: "#f4a423", fontWeight: 600, marginTop: "4px" }}>🎁 Freebie</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </s-section>
      )}

      <s-section slot="aside" heading="💡 Upsell Tips">
        <s-paragraph>Show 2-3 complementary products for best conversion rates.</s-paragraph>
        <s-paragraph>Freebie selectors increase cart value by 25% on average.</s-paragraph>
        <s-paragraph>Set freebie threshold 30% above your average order value.</s-paragraph>
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
