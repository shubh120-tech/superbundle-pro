import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  let importHistory = [];
  try {
    importHistory = await db.review.findMany({
      where: { shop: session.shop, source: "import" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, productTitle: true, importSource: true, createdAt: true, rating: true, published: true },
    });
  } catch (e) {
    console.warn("DB query failed:", e.message);
  }
  return { importHistory };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "csv_import") {
    const csvData = formData.get("csvData");
    const productId = formData.get("productId") || "unknown";
    const autoPublish = formData.get("autoPublish") === "true";

    try {
      const lines = csvData.split("\n").filter(Boolean);
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
      const reviews = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim().replace(/"/g, ""));
        const row = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ""; });

        if (!row.rating || !row.name) continue;

        reviews.push({
          shop: session.shop,
          productId,
          productTitle: row.product || "",
          customerName: row.name || "Anonymous",
          customerEmail: row.email || "",
          rating: Math.min(5, Math.max(1, parseInt(row.rating) || 5)),
          title: row.title || "",
          body: row.review || row.body || "",
          verified: row.verified === "true",
          published: autoPublish,
          source: "import",
          importSource: "csv",
        });
      }

      await db.review.createMany({ data: reviews });
      return { success: true, imported: reviews.length };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  return { success: false, message: "Unknown intent" };
};

export default function ReviewImport() {
  const { importHistory } = useLoaderData();
  const fetcher = useFetcher();
  const isSaving = fetcher.state === "submitting";

  const [activeTab, setActiveTab] = useState("csv");
  const [csvData, setCsvData] = useState("");
  const [productId, setProductId] = useState("");
  const [autoPublish, setAutoPublish] = useState(false);

  const handleCsvImport = () => {
    fetcher.submit(
      { intent: "csv_import", csvData, productId, autoPublish: String(autoPublish) },
      { method: "POST" }
    );
  };

  const tabs = ["csv", "amazon", "aliexpress", "history"];
  const tabLabels = { csv: "📄 CSV Import", amazon: "📦 Amazon", aliexpress: "🛒 AliExpress", history: "📋 History" };

  const sampleCsv = `name,email,rating,title,review,verified
"Priya Sharma","priya@example.com",5,"Amazing product!","Really loved this product. Great quality.",true
"Rohit Mehta","rohit@example.com",4,"Good value","Good product for the price.",false
"Anjali Verma","anjali@example.com",5,"Highly recommend","Will definitely buy again!",true`;

  return (
    <s-page heading="Import Reviews">
      {fetcher.data?.success && (
        <s-banner tone="success">Successfully imported {fetcher.data.imported} reviews!</s-banner>
      )}
      {fetcher.data?.success === false && (
        <s-banner tone="critical">{fetcher.data.message}</s-banner>
      )}

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

      {/* CSV Import */}
      {activeTab === "csv" && (
        <s-section heading="CSV Import" description="Import reviews from a CSV file. Supports exports from most review platforms.">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            <div style={{ padding: "14px 16px", background: "#f6f6f7", borderRadius: "8px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#202223", marginBottom: "8px" }}>Required CSV format:</div>
              <pre style={{ fontSize: "12px", color: "#6d7175", margin: 0, overflowX: "auto" }}>{sampleCsv}</pre>
              <button
                onClick={() => {
                  const blob = new Blob([sampleCsv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = "review_template.csv"; a.click();
                }}
                style={{ marginTop: "10px", padding: "6px 14px", background: "#5C6AC4", color: "white", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
              >
                ⬇️ Download Template
              </button>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Product ID (optional)</label>
              <input type="text" value={productId} onChange={e => setProductId(e.target.value)}
                placeholder="gid://shopify/Product/123456" style={inputStyle} />
              <div style={hintStyle}>Leave blank to import without product association</div>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Paste CSV data</label>
              <textarea
                value={csvData} onChange={e => setCsvData(e.target.value)}
                placeholder={sampleCsv}
                rows={10}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: "12px" }}
              />
            </div>

            <div style={rowStyle}>
              <div>
                <div style={labelStyle}>Auto-publish imported reviews</div>
                <div style={hintStyle}>Publish immediately without manual approval</div>
              </div>
              <label style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={autoPublish} onChange={e => setAutoPublish(e.target.checked)} style={{ display: "none" }} />
                <div style={{ ...toggleStyle, background: autoPublish ? "#008060" : "#c9cccf" }}>
                  <div style={{ ...toggleDotStyle, transform: autoPublish ? "translateX(20px)" : "translateX(2px)" }} />
                </div>
              </label>
            </div>

            <button
              onClick={handleCsvImport}
              disabled={!csvData.trim() || isSaving}
              style={{
                padding: "10px 24px", background: csvData.trim() ? "#008060" : "#c9cccf",
                color: "white", border: "none", borderRadius: "7px",
                fontSize: "13px", fontWeight: 700, cursor: csvData.trim() ? "pointer" : "not-allowed",
                alignSelf: "flex-start",
              }}
            >
              {isSaving ? "Importing..." : "📥 Import Reviews"}
            </button>
          </div>
        </s-section>
      )}

      {/* Amazon */}
      {activeTab === "amazon" && (
        <s-section heading="Import from Amazon" description="Import product reviews from Amazon listings.">
          <div style={{
            padding: "32px", textAlign: "center",
            border: "2px dashed #e1e3e5", borderRadius: "10px",
          }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>📦</div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "#202223", marginBottom: "8px" }}>Amazon Import</div>
            <div style={{ fontSize: "13px", color: "#6d7175", maxWidth: "360px", margin: "0 auto 16px" }}>
              Enter your Amazon product URL or ASIN to import verified reviews directly.
            </div>
            <input type="text" placeholder="https://amazon.in/dp/ASINCODE or ASINCODE"
              style={{ ...inputStyle, maxWidth: "400px", marginBottom: "12px" }} />
            <div>
              <button style={{ padding: "10px 24px", background: "#f4a423", color: "white", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                🔍 Fetch Amazon Reviews
              </button>
            </div>
            <div style={{ marginTop: "12px", fontSize: "12px", color: "#6d7175" }}>
              ⚠️ Only imports publicly visible reviews. Complies with Amazon ToS.
            </div>
          </div>
        </s-section>
      )}

      {/* AliExpress */}
      {activeTab === "aliexpress" && (
        <s-section heading="Import from AliExpress" description="Import product reviews from AliExpress listings.">
          <div style={{
            padding: "32px", textAlign: "center",
            border: "2px dashed #e1e3e5", borderRadius: "10px",
          }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🛒</div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "#202223", marginBottom: "8px" }}>AliExpress Import</div>
            <div style={{ fontSize: "13px", color: "#6d7175", maxWidth: "360px", margin: "0 auto 16px" }}>
              Enter your AliExpress product URL to import reviews with photos.
            </div>
            <input type="text" placeholder="https://aliexpress.com/item/..." style={{ ...inputStyle, maxWidth: "400px", marginBottom: "12px" }} />
            <div>
              <button style={{ padding: "10px 24px", background: "#e62a10", color: "white", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                🔍 Fetch AliExpress Reviews
              </button>
            </div>
          </div>
        </s-section>
      )}

      {/* History */}
      {activeTab === "history" && (
        <s-section heading="Import History">
          {importHistory.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#6d7175", fontSize: "13px" }}>
              No imports yet. Import reviews using CSV, Amazon, or AliExpress tabs.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e1e3e5" }}>
                    {["Product", "Source", "Rating", "Status", "Imported"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: "#6d7175", fontSize: "12px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importHistory.map(r => (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
                      <td style={{ padding: "12px" }}>{r.productTitle || "—"}</td>
                      <td style={{ padding: "12px", textTransform: "capitalize" }}>{r.importSource || "csv"}</td>
                      <td style={{ padding: "12px", color: "#f4a423" }}>{"★".repeat(r.rating)}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{
                          padding: "3px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: 600,
                          background: r.published ? "#e3f1eb" : "#fff4e5",
                          color: r.published ? "#008060" : "#b5731d",
                        }}>
                          {r.published ? "Published" : "Pending"}
                        </span>
                      </td>
                      <td style={{ padding: "12px", color: "#6d7175" }}>
                        {new Date(r.createdAt).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </s-section>
      )}

      <s-section slot="aside" heading="📥 Import Tips">
        <s-paragraph>CSV import is the fastest way — export from any review platform and reformat to our template.</s-paragraph>
        <s-paragraph>Always review imported reviews before publishing to ensure quality.</s-paragraph>
        <s-paragraph>Use auto-publish only for imports from trusted sources like your previous review app.</s-paragraph>
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
