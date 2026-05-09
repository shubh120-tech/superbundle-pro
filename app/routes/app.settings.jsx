import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  let settings = null;
  let shopInfo = { name: "", email: "", domain: "", currencyCode: "INR", plan: "" };
  try {
    const [s, res] = await Promise.all([
      db.appSettings.findUnique({ where: { shop: session.shop } }),
      admin.graphql(`query { shop { name email myshopifyDomain currencyCode plan { displayName } } }`),
    ]);
    settings = s;
    const data = await res.json();
    const shop = data?.data?.shop;
    if (shop) shopInfo = { name: shop.name, email: shop.email, domain: shop.myshopifyDomain, currencyCode: shop.currencyCode, plan: shop.plan?.displayName };
  } catch (e) { console.warn("Error:", e.message); }
  return { settings, shopInfo };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  try {
    await db.appSettings.upsert({
      where: { shop: session.shop },
      update: { storeName: data.storeName || "", currency: data.currency || "INR", timezone: data.timezone || "Asia/Kolkata" },
      create: { shop: session.shop, storeName: data.storeName || "", currency: data.currency || "INR", timezone: data.timezone || "Asia/Kolkata" },
    });
  } catch (e) { return { success: false, message: e.message }; }
  return { success: true };
};

export default function SettingsPage() {
  const { settings: s, shopInfo } = useLoaderData();
  const fetcher = useFetcher();
  const isSaving = fetcher.state === "submitting";

  const [storeName, setStoreName] = useState(s?.storeName ?? "");
  const [currency, setCurrency] = useState(s?.currency ?? "INR");
  const [timezone, setTimezone] = useState(s?.timezone ?? "Asia/Kolkata");
  const [activeTab, setActiveTab] = useState("general");

  const handleSave = () => {
    fetcher.submit({ storeName, currency, timezone }, { method: "POST" });
  };

  const tabs = ["general", "store-info", "tools"];
  const tabLabels = { general: "⚙️ General", "store-info": "🏪 Store Info", tools: "🛠️ Tools" };

  return (
    <s-page heading="Settings">
      <s-button slot="primary-action" onClick={handleSave} {...(isSaving ? { loading: true } : {})}>
        {isSaving ? "Saving..." : "Save Settings"}
      </s-button>
      {fetcher.data?.success && <s-banner tone="success">Settings saved!</s-banner>}

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

      {activeTab === "general" && (
        <s-section heading="General Settings">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Store display name</label>
              <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)} placeholder={shopInfo.name} style={{ ...inputStyle, maxWidth: "320px" }} />
              <div style={hintStyle}>Used in review emails and branded pages</div>
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...inputStyle, maxWidth: "280px" }}>
                {[["INR", "₹ INR — Indian Rupee"], ["USD", "$ USD — US Dollar"], ["EUR", "€ EUR — Euro"], ["GBP", "£ GBP — British Pound"], ["AED", "د.إ AED — UAE Dirham"], ["SGD", "S$ SGD — Singapore Dollar"]].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Timezone</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} style={{ ...inputStyle, maxWidth: "320px" }}>
                {[["Asia/Kolkata", "Asia/Kolkata (IST, UTC+5:30)"], ["Asia/Dubai", "Asia/Dubai (GST, UTC+4)"], ["America/New_York", "America/New_York (EST)"], ["Europe/London", "Europe/London (GMT)"], ["Asia/Singapore", "Asia/Singapore (SGT, UTC+8)"]].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
        </s-section>
      )}

      {activeTab === "store-info" && (
        <s-section heading="Store Information">
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {[
              { label: "Store name", value: shopInfo.name },
              { label: "Email", value: shopInfo.email },
              { label: "Domain", value: shopInfo.domain },
              { label: "Currency", value: shopInfo.currencyCode },
              { label: "Shopify plan", value: shopInfo.plan },
              { label: "App version", value: "1.0.0" },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #f1f1f1", fontSize: "13px" }}>
                <span style={{ color: "#6d7175" }}>{item.label}</span>
                <span style={{ fontWeight: 600, color: "#202223" }}>{item.value || "—"}</span>
              </div>
            ))}
          </div>
        </s-section>
      )}

      {activeTab === "tools" && (
        <s-section heading="Tool Configuration">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { name: "Product Reviews", icon: "⭐", href: "/app/reviews", desc: "Collect and display product reviews" },
              { name: "Smart Cart", icon: "🛒", href: "/app/smart-cart", desc: "Cart drawer, upsell, milestones, COD nudge" },
              { name: "Shoppable Videos", icon: "🎥", href: "/app/videos", desc: "TikTok/Instagram shoppable video widgets" },
            ].map(tool => (
              <a key={tool.name} href={tool.href} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", border: "1px solid #e1e3e5", borderRadius: "10px", textDecoration: "none", background: "white" }}>
                <span style={{ fontSize: "24px" }}>{tool.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#202223" }}>{tool.name}</div>
                  <div style={{ fontSize: "12px", color: "#6d7175" }}>{tool.desc}</div>
                </div>
                <span style={{ color: "#6d7175", fontSize: "16px" }}>→</span>
              </a>
            ))}
          </div>
        </s-section>
      )}

      <s-section slot="aside" heading="🆘 Support">
        {[{ label: "📧 Email", value: "support@superbundlepro.app" }, { label: "📖 Docs", value: "docs.superbundlepro.app" }, { label: "💬 Chat", value: "Mon–Fri 9am–6pm IST" }].map(item => (
          <div key={item.label} style={{ padding: "8px 0", borderBottom: "1px solid #f1f1f1" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#202223" }}>{item.label}</div>
            <div style={{ fontSize: "12px", color: "#6d7175" }}>{item.value}</div>
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

export const headers = (headersArgs) => boundary.headers(headersArgs);
