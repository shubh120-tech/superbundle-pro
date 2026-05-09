import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  let settings = null;
  let requests = [];

  try {
    [settings, requests] = await Promise.all([
      db.reviewSettings.findUnique({ where: { shop: session.shop } }),
      db.reviewRequest.findMany({
        where: { shop: session.shop },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);
  } catch (e) {
    console.warn("DB query failed:", e.message);
  }

  return { settings, requests };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  const parsed = {
    autoRequestEnabled: data.autoRequestEnabled === "true",
    requestDelay: parseInt(data.requestDelay || 7),
    requestSubject: data.requestSubject || "How was your order?",
    requestBody: data.requestBody || "We'd love your feedback.",
    reminderEnabled: data.reminderEnabled === "true",
    reminderDelay: parseInt(data.reminderDelay || 14),
    incentiveEnabled: data.incentiveEnabled === "true",
    incentiveType: data.incentiveType || "discount",
    incentiveValue: parseFloat(data.incentiveValue || 10),
  };

  try {
    await db.reviewSettings.upsert({
      where: { shop: session.shop },
      update: parsed,
      create: { shop: session.shop, ...parsed },
    });
  } catch (e) {
    return { success: false, message: e.message };
  }

  return { success: true };
};

export default function ReviewRequests() {
  const { settings: s, requests } = useLoaderData();
  const fetcher = useFetcher();
  const isSaving = fetcher.state === "submitting";

  const [autoRequest, setAutoRequest] = useState(s?.autoRequestEnabled ?? true);
  const [requestDelay, setRequestDelay] = useState(s?.requestDelay ?? 7);
  const [requestSubject, setRequestSubject] = useState(s?.requestSubject ?? "How was your order? Leave a review!");
  const [requestBody, setRequestBody] = useState(s?.requestBody ?? "We'd love to hear your feedback.");
  const [reminderEnabled, setReminderEnabled] = useState(s?.reminderEnabled ?? true);
  const [reminderDelay, setReminderDelay] = useState(s?.reminderDelay ?? 14);
  const [incentiveEnabled, setIncentiveEnabled] = useState(s?.incentiveEnabled ?? false);
  const [incentiveType, setIncentiveType] = useState(s?.incentiveType ?? "discount");
  const [incentiveValue, setIncentiveValue] = useState(s?.incentiveValue ?? 10);
  const [activeTab, setActiveTab] = useState("settings");

  const handleSave = () => {
    fetcher.submit({
      autoRequestEnabled: String(autoRequest),
      requestDelay, requestSubject, requestBody,
      reminderEnabled: String(reminderEnabled),
      reminderDelay,
      incentiveEnabled: String(incentiveEnabled),
      incentiveType, incentiveValue,
    }, { method: "POST" });
  };

  const statusColor = { pending: "#f4a423", sent: "#5C6AC4", reminded: "#b5731d", completed: "#008060" };
  const tabs = ["settings", "email", "incentive", "queue"];
  const tabLabels = { settings: "⚙️ Settings", email: "📧 Email Template", incentive: "🎁 Incentive", queue: "📋 Request Queue" };

  return (
    <s-page heading="Review Requests">
      <s-button slot="primary-action" onClick={handleSave} {...(isSaving ? { loading: true } : {})}>
        {isSaving ? "Saving..." : "Save Settings"}
      </s-button>

      {fetcher.data?.success && <s-banner tone="success">Review request settings saved!</s-banner>}
      {fetcher.data?.success === false && <s-banner tone="critical">{fetcher.data.message}</s-banner>}

      {/* Tab bar */}
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

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <s-section heading="Automatic Review Requests" description="Send review request emails automatically after order fulfillment.">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={rowStyle}>
              <div>
                <div style={labelStyle}>Enable automatic review requests</div>
                <div style={hintStyle}>Automatically email customers after their order is delivered</div>
              </div>
              <label style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={autoRequest} onChange={e => setAutoRequest(e.target.checked)} style={{ display: "none" }} />
                <div style={{ ...toggleStyle, background: autoRequest ? "#008060" : "#c9cccf" }}>
                  <div style={{ ...toggleDotStyle, transform: autoRequest ? "translateX(20px)" : "translateX(2px)" }} />
                </div>
              </label>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Send request after (days)</label>
              <input type="number" value={requestDelay} onChange={e => setRequestDelay(Number(e.target.value))}
                min={1} max={30} style={{ ...inputStyle, maxWidth: "120px" }} />
              <div style={hintStyle}>Days after order fulfillment to send the review request</div>
            </div>

            <div style={rowStyle}>
              <div>
                <div style={labelStyle}>Enable reminder email</div>
                <div style={hintStyle}>Send a follow-up if customer doesn't respond</div>
              </div>
              <label style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={reminderEnabled} onChange={e => setReminderEnabled(e.target.checked)} style={{ display: "none" }} />
                <div style={{ ...toggleStyle, background: reminderEnabled ? "#008060" : "#c9cccf" }}>
                  <div style={{ ...toggleDotStyle, transform: reminderEnabled ? "translateX(20px)" : "translateX(2px)" }} />
                </div>
              </label>
            </div>

            {reminderEnabled && (
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Send reminder after (days)</label>
                <input type="number" value={reminderDelay} onChange={e => setReminderDelay(Number(e.target.value))}
                  min={1} max={60} style={{ ...inputStyle, maxWidth: "120px" }} />
                <div style={hintStyle}>Days after first request to send the reminder</div>
              </div>
            )}
          </div>
        </s-section>
      )}

      {/* Email Template Tab */}
      {activeTab === "email" && (
        <s-section heading="Email Template" description="Customize the review request email sent to customers.">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Email subject</label>
              <input type="text" value={requestSubject} onChange={e => setRequestSubject(e.target.value)} style={inputStyle} />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Email body</label>
              <textarea value={requestBody} onChange={e => setRequestBody(e.target.value)}
                rows={6} style={{ ...inputStyle, resize: "vertical" }} />
              <div style={hintStyle}>
                Available variables: {"{customer_name}"}, {"{product_name}"}, {"{order_number}"}, {"{review_link}"}
              </div>
            </div>

            {/* Preview */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Preview</label>
              <div style={{
                border: "1px solid #e1e3e5", borderRadius: "8px",
                overflow: "hidden", maxWidth: "480px",
              }}>
                <div style={{ background: "#5C6AC4", padding: "16px 24px" }}>
                  <div style={{ color: "white", fontWeight: 700, fontSize: "18px" }}>SuperBundle Pro</div>
                </div>
                <div style={{ padding: "24px", background: "white" }}>
                  <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "12px", color: "#202223" }}>
                    {requestSubject}
                  </div>
                  <div style={{ fontSize: "14px", color: "#6d7175", lineHeight: 1.6, marginBottom: "20px" }}>
                    {requestBody.replace("{customer_name}", "Priya").replace("{product_name}", "Your Product").replace("{order_number}", "#1042")}
                  </div>
                  <div style={{
                    display: "inline-block", padding: "12px 24px",
                    background: "#5C6AC4", color: "white",
                    borderRadius: "6px", fontSize: "14px", fontWeight: 600,
                  }}>
                    ⭐ Leave a Review
                  </div>
                </div>
              </div>
            </div>
          </div>
        </s-section>
      )}

      {/* Incentive Tab */}
      {activeTab === "incentive" && (
        <s-section heading="Review Incentive" description="Offer a reward to encourage customers to leave reviews.">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={rowStyle}>
              <div>
                <div style={labelStyle}>Enable review incentive</div>
                <div style={hintStyle}>Reward customers who submit a review</div>
              </div>
              <label style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={incentiveEnabled} onChange={e => setIncentiveEnabled(e.target.checked)} style={{ display: "none" }} />
                <div style={{ ...toggleStyle, background: incentiveEnabled ? "#008060" : "#c9cccf" }}>
                  <div style={{ ...toggleDotStyle, transform: incentiveEnabled ? "translateX(20px)" : "translateX(2px)" }} />
                </div>
              </label>
            </div>

            {incentiveEnabled && (
              <>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Incentive type</label>
                  <select value={incentiveType} onChange={e => setIncentiveType(e.target.value)} style={{ ...inputStyle, maxWidth: "240px" }}>
                    <option value="discount">Discount code</option>
                    <option value="points">Loyalty points</option>
                    <option value="freebie">Free gift</option>
                  </select>
                </div>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>
                    {incentiveType === "discount" ? "Discount value (%)" :
                      incentiveType === "points" ? "Points awarded" : "Gift description"}
                  </label>
                  <input type={incentiveType === "freebie" ? "text" : "number"}
                    value={incentiveValue} onChange={e => setIncentiveValue(e.target.value)}
                    style={{ ...inputStyle, maxWidth: "200px" }} />
                </div>
                <div style={{
                  padding: "14px 16px", background: "#f0f7ff",
                  border: "1px solid #b3d4ff", borderRadius: "8px",
                  fontSize: "13px", color: "#0c4a8f",
                }}>
                  💡 Incentive will be sent automatically after the review is approved and published.
                </div>
              </>
            )}
          </div>
        </s-section>
      )}

      {/* Request Queue Tab */}
      {activeTab === "queue" && (
        <s-section heading="Request Queue">
          {requests.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#6d7175", fontSize: "13px" }}>
              No review requests sent yet. Enable automatic requests to start collecting reviews.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e1e3e5" }}>
                    {["Order", "Email", "Status", "Sent At", "Reminder"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: "#6d7175", fontSize: "12px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
                      <td style={{ padding: "12px", fontWeight: 600 }}>{r.orderId}</td>
                      <td style={{ padding: "12px" }}>{r.email}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{
                          padding: "3px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: 600,
                          background: `${statusColor[r.status]}18`, color: statusColor[r.status],
                        }}>{r.status}</span>
                      </td>
                      <td style={{ padding: "12px", color: "#6d7175" }}>
                        {r.sentAt ? new Date(r.sentAt).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td style={{ padding: "12px", color: "#6d7175" }}>
                        {r.reminderAt ? new Date(r.reminderAt).toLocaleDateString("en-IN") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </s-section>
      )}

      <s-section slot="aside" heading="📊 Request Stats">
        {[
          { label: "Total sent", value: requests.length },
          { label: "Pending", value: requests.filter(r => r.status === "pending").length },
          { label: "Completed", value: requests.filter(r => r.status === "completed").length },
          { label: "Response rate", value: requests.length > 0 ? `${Math.round((requests.filter(r => r.status === "completed").length / requests.length) * 100)}%` : "0%" },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f1f1", fontSize: "13px" }}>
            <span style={{ color: "#6d7175" }}>{s.label}</span>
            <span style={{ fontWeight: 600 }}>{s.value}</span>
          </div>
        ))}
      </s-section>

      <s-section slot="aside" heading="💡 Tips">
        <s-paragraph>Send requests 5-7 days after delivery for best response rates.</s-paragraph>
        <s-paragraph>A 10% discount incentive can double your review response rate.</s-paragraph>
        <s-paragraph>Personalize emails with customer name and product for higher open rates.</s-paragraph>
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
