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
      update: {
        codRestrictionEnabled: data.codRestrictionEnabled === "true",
        codMinOrderValue: parseFloat(data.codMinOrderValue || 0),
        codMaxOrderValue: parseFloat(data.codMaxOrderValue || 10000),
        prepaidNudgeEnabled: data.prepaidNudgeEnabled === "true",
        prepaidDiscount: parseFloat(data.prepaidDiscount || 50),
        prepaidDiscountType: data.prepaidDiscountType || "flat",
        discountEnabled: data.discountEnabled === "true",
        discountCodes: data.discountCodes || "[]",
      },
      create: {
        shop: session.shop,
        codRestrictionEnabled: data.codRestrictionEnabled === "true",
        codMinOrderValue: parseFloat(data.codMinOrderValue || 0),
        codMaxOrderValue: parseFloat(data.codMaxOrderValue || 10000),
        prepaidNudgeEnabled: data.prepaidNudgeEnabled === "true",
        prepaidDiscount: parseFloat(data.prepaidDiscount || 50),
        prepaidDiscountType: data.prepaidDiscountType || "flat",
        discountEnabled: data.discountEnabled === "true",
        discountCodes: data.discountCodes || "[]",
      },
    });
  } catch (e) { return { success: false, message: e.message }; }
  return { success: true };
};

export default function CodSettingsPage() {
  const { settings: s } = useLoaderData();
  const fetcher = useFetcher();
  const isSaving = fetcher.state === "submitting";

  const [codRestrictionEnabled, setCodRestrictionEnabled] = useState(s?.codRestrictionEnabled ?? false);
  const [codMinOrderValue, setCodMinOrderValue] = useState(s?.codMinOrderValue ?? 0);
  const [codMaxOrderValue, setCodMaxOrderValue] = useState(s?.codMaxOrderValue ?? 10000);
  const [prepaidNudgeEnabled, setPrepaidNudgeEnabled] = useState(s?.prepaidNudgeEnabled ?? true);
  const [prepaidDiscount, setPrepaidDiscount] = useState(s?.prepaidDiscount ?? 50);
  const [prepaidDiscountType, setPrepaidDiscountType] = useState(s?.prepaidDiscountType ?? "flat");
  const [discountEnabled, setDiscountEnabled] = useState(s?.discountEnabled ?? false);
  const [discountCodes, setDiscountCodes] = useState(() => {
    try { return JSON.parse(s?.discountCodes ?? "[]"); } catch { return []; }
  });

  const addDiscountCode = () => {
    setDiscountCodes(prev => [...prev, { code: "", label: "", value: "" }]);
  };

  const updateCode = (idx, field, value) => {
    setDiscountCodes(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const removeCode = (idx) => {
    setDiscountCodes(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    fetcher.submit({
      codRestrictionEnabled: String(codRestrictionEnabled),
      codMinOrderValue, codMaxOrderValue,
      prepaidNudgeEnabled: String(prepaidNudgeEnabled),
      prepaidDiscount, prepaidDiscountType,
      discountEnabled: String(discountEnabled),
      discountCodes: JSON.stringify(discountCodes),
    }, { method: "POST" });
  };

  return (
    <s-page heading="COD Settings">
      <s-button slot="primary-action" onClick={handleSave} {...(isSaving ? { loading: true } : {})}>
        {isSaving ? "Saving..." : "Save Settings"}
      </s-button>
      {fetcher.data?.success && <s-banner tone="success">COD settings saved!</s-banner>}

      <s-section heading="COD Restrictions" description="Control when COD is available to customers.">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={rowStyle}>
            <div><div style={labelStyle}>Enable COD restrictions</div><div style={hintStyle}>Limit COD based on order value</div></div>
            <label style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={codRestrictionEnabled} onChange={e => setCodRestrictionEnabled(e.target.checked)} style={{ display: "none" }} />
              <div style={{ ...toggleStyle, background: codRestrictionEnabled ? "#008060" : "#c9cccf" }}><div style={{ ...toggleDotStyle, transform: codRestrictionEnabled ? "translateX(20px)" : "translateX(2px)" }} /></div>
            </label>
          </div>
          {codRestrictionEnabled && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Minimum order value (₹)</label>
                <input type="number" value={codMinOrderValue} onChange={e => setCodMinOrderValue(Number(e.target.value))} style={inputStyle} />
                <div style={hintStyle}>COD available only above this amount</div>
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Maximum order value (₹)</label>
                <input type="number" value={codMaxOrderValue} onChange={e => setCodMaxOrderValue(Number(e.target.value))} style={inputStyle} />
                <div style={hintStyle}>COD blocked above this amount</div>
              </div>
            </div>
          )}
        </div>
      </s-section>

      <s-section heading="Prepaid Incentive" description="Offer a discount to nudge customers from COD to prepaid payment.">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={rowStyle}>
            <div><div style={labelStyle}>Enable prepaid incentive</div><div style={hintStyle}>Show discount banner when customer selects COD</div></div>
            <label style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={prepaidNudgeEnabled} onChange={e => setPrepaidNudgeEnabled(e.target.checked)} style={{ display: "none" }} />
              <div style={{ ...toggleStyle, background: prepaidNudgeEnabled ? "#008060" : "#c9cccf" }}><div style={{ ...toggleDotStyle, transform: prepaidNudgeEnabled ? "translateX(20px)" : "translateX(2px)" }} /></div>
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Discount amount</label>
              <input type="number" value={prepaidDiscount} onChange={e => setPrepaidDiscount(Number(e.target.value))} style={inputStyle} />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Discount type</label>
              <select value={prepaidDiscountType} onChange={e => setPrepaidDiscountType(e.target.value)} style={inputStyle}>
                <option value="flat">Flat (₹)</option>
                <option value="percent">Percentage (%)</option>
              </select>
            </div>
          </div>
          {prepaidNudgeEnabled && (
            <div style={{ padding: "14px 16px", background: "#f1f8f5", border: "1px solid #008060", borderRadius: "8px", fontSize: "13px" }}>
              <strong style={{ color: "#008060" }}>Preview:</strong>
              <div style={{ color: "#202223", marginTop: "4px" }}>
                💳 Pay online & save {prepaidDiscountType === "flat" ? `₹${prepaidDiscount}` : `${prepaidDiscount}%`} on this order!
              </div>
            </div>
          )}
        </div>
      </s-section>

      <s-section heading="Smart Discount Codes" description="Show discount codes inside the cart for customers to apply.">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={rowStyle}>
            <div><div style={labelStyle}>Enable discount code selector</div><div style={hintStyle}>Show available discount codes in cart drawer</div></div>
            <label style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={discountEnabled} onChange={e => setDiscountEnabled(e.target.checked)} style={{ display: "none" }} />
              <div style={{ ...toggleStyle, background: discountEnabled ? "#008060" : "#c9cccf" }}><div style={{ ...toggleDotStyle, transform: discountEnabled ? "translateX(20px)" : "translateX(2px)" }} /></div>
            </label>
          </div>
          {discountEnabled && (
            <>
              {discountCodes.map((code, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "10px", alignItems: "flex-end" }}>
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Code</label>
                    <input type="text" value={code.code} onChange={e => updateCode(idx, "code", e.target.value)} placeholder="SAVE10" style={inputStyle} />
                  </div>
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Label</label>
                    <input type="text" value={code.label} onChange={e => updateCode(idx, "label", e.target.value)} placeholder="10% off" style={inputStyle} />
                  </div>
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Value</label>
                    <input type="text" value={code.value} onChange={e => updateCode(idx, "value", e.target.value)} placeholder="10%" style={inputStyle} />
                  </div>
                  <button onClick={() => removeCode(idx)} style={{ padding: "8px 10px", background: "#fbe9e7", color: "#d72c0d", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "16px" }}>🗑</button>
                </div>
              ))}
              <button onClick={addDiscountCode} style={{ padding: "8px 16px", border: "2px dashed #c9cccf", borderRadius: "7px", background: "none", cursor: "pointer", fontSize: "13px", color: "#6d7175", fontWeight: 600, alignSelf: "flex-start" }}>
                + Add Discount Code
              </button>
            </>
          )}
        </div>
      </s-section>

      <s-section slot="aside" heading="💡 COD Tips">
        <s-paragraph>A ₹50-100 prepaid discount converts 30-40% of COD orders.</s-paragraph>
        <s-paragraph>Restrict COD above ₹5000 to reduce RTO on high-value orders.</s-paragraph>
        <s-paragraph>Show 2-3 discount codes max to avoid decision paralysis.</s-paragraph>
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
