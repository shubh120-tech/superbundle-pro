import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  let settings = null;
  try {
    settings = await db.reviewSettings.findUnique({ where: { shop: session.shop } });
  } catch (e) {
    console.warn("DB query failed:", e.message);
  }
  return { settings };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  const parsed = {
    widgetTheme: data.widgetTheme || "light",
    primaryColor: data.primaryColor || "#5C6AC4",
    showStarRating: data.showStarRating === "true",
    showReviewCount: data.showReviewCount === "true",
    showVerifiedBadge: data.showVerifiedBadge === "true",
    showPhotos: data.showPhotos === "true",
    reviewsPerPage: parseInt(data.reviewsPerPage || 10),
    sortDefault: data.sortDefault || "recent",
    seoSnippetsEnabled: data.seoSnippetsEnabled === "true",
    qaEnabled: data.qaEnabled === "true",
    allowPhotoReviews: data.allowPhotoReviews === "true",
    allowVideoReviews: data.allowVideoReviews === "true",
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

export default function ReviewWidgets() {
  const { settings: s } = useLoaderData();
  const fetcher = useFetcher();
  const isSaving = fetcher.state === "submitting";

  const [widgetTheme, setWidgetTheme] = useState(s?.widgetTheme ?? "light");
  const [primaryColor, setPrimaryColor] = useState(s?.primaryColor ?? "#5C6AC4");
  const [showStarRating, setShowStarRating] = useState(s?.showStarRating ?? true);
  const [showReviewCount, setShowReviewCount] = useState(s?.showReviewCount ?? true);
  const [showVerifiedBadge, setShowVerifiedBadge] = useState(s?.showVerifiedBadge ?? true);
  const [showPhotos, setShowPhotos] = useState(s?.showPhotos ?? true);
  const [reviewsPerPage, setReviewsPerPage] = useState(s?.reviewsPerPage ?? 10);
  const [sortDefault, setSortDefault] = useState(s?.sortDefault ?? "recent");
  const [seoEnabled, setSeoEnabled] = useState(s?.seoSnippetsEnabled ?? true);
  const [qaEnabled, setQaEnabled] = useState(s?.qaEnabled ?? false);
  const [allowPhotos, setAllowPhotos] = useState(s?.allowPhotoReviews ?? true);
  const [allowVideos, setAllowVideos] = useState(s?.allowVideoReviews ?? false);
  const [activeTab, setActiveTab] = useState("display");

  const handleSave = () => {
    fetcher.submit({
      widgetTheme, primaryColor,
      showStarRating: String(showStarRating),
      showReviewCount: String(showReviewCount),
      showVerifiedBadge: String(showVerifiedBadge),
      showPhotos: String(showPhotos),
      reviewsPerPage, sortDefault,
      seoSnippetsEnabled: String(seoEnabled),
      qaEnabled: String(qaEnabled),
      allowPhotoReviews: String(allowPhotos),
      allowVideoReviews: String(allowVideos),
    }, { method: "POST" });
  };

  const tabs = ["display", "collection", "seo", "placements"];
  const tabLabels = { display: "🎨 Display", collection: "📸 Collection", seo: "🔍 SEO", placements: "📍 Placements" };

  // Sample review for preview
  const previewBg = widgetTheme === "dark" ? "#1a1a2e" : "white";
  const previewText = widgetTheme === "dark" ? "#fff" : "#202223";
  const previewSubText = widgetTheme === "dark" ? "rgba(255,255,255,0.5)" : "#6d7175";

  return (
    <s-page heading="Review Widgets">
      <s-button slot="primary-action" onClick={handleSave} {...(isSaving ? { loading: true } : {})}>
        {isSaving ? "Saving..." : "Save Settings"}
      </s-button>

      {fetcher.data?.success && <s-banner tone="success">Widget settings saved!</s-banner>}

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

      {/* Display Tab */}
      {activeTab === "display" && (
        <>
          <s-section heading="Theme & Colors">
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Widget theme</label>
                <div style={{ display: "flex", gap: "12px" }}>
                  {["light", "dark", "custom"].map(t => (
                    <button key={t} onClick={() => setWidgetTheme(t)} style={{
                      padding: "8px 20px", borderRadius: "7px", cursor: "pointer",
                      border: `2px solid ${widgetTheme === t ? primaryColor : "#e1e3e5"}`,
                      background: widgetTheme === t ? `${primaryColor}10` : "white",
                      fontSize: "13px", fontWeight: widgetTheme === t ? 600 : 400,
                      color: widgetTheme === t ? primaryColor : "#6d7175",
                      textTransform: "capitalize",
                    }}>{t}</button>
                  ))}
                </div>
              </div>

              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Primary color</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                    style={{ width: "44px", height: "36px", border: "1px solid #c9cccf", borderRadius: "6px", cursor: "pointer" }} />
                  <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                    style={{ ...inputStyle, maxWidth: "140px", fontFamily: "monospace" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Reviews per page</label>
                  <select value={reviewsPerPage} onChange={e => setReviewsPerPage(Number(e.target.value))} style={inputStyle}>
                    {[5, 10, 15, 20, 25].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Default sort</label>
                  <select value={sortDefault} onChange={e => setSortDefault(e.target.value)} style={inputStyle}>
                    <option value="recent">Most Recent</option>
                    <option value="highest">Highest Rated</option>
                    <option value="lowest">Lowest Rated</option>
                    <option value="helpful">Most Helpful</option>
                  </select>
                </div>
              </div>
            </div>
          </s-section>

          <s-section heading="Display Options">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { label: "Show star rating", hint: "Display star rating summary at top", value: showStarRating, set: setShowStarRating },
                { label: "Show review count", hint: "Show total number of reviews", value: showReviewCount, set: setShowReviewCount },
                { label: "Show verified badge", hint: "Display 'Verified Purchase' badge", value: showVerifiedBadge, set: setShowVerifiedBadge },
                { label: "Show review photos", hint: "Display customer uploaded photos", value: showPhotos, set: setShowPhotos },
              ].map(item => (
                <div key={item.label} style={rowStyle}>
                  <div>
                    <div style={labelStyle}>{item.label}</div>
                    <div style={hintStyle}>{item.hint}</div>
                  </div>
                  <label style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={item.value} onChange={e => item.set(e.target.checked)} style={{ display: "none" }} />
                    <div style={{ ...toggleStyle, background: item.value ? primaryColor : "#c9cccf" }}>
                      <div style={{ ...toggleDotStyle, transform: item.value ? "translateX(20px)" : "translateX(2px)" }} />
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </s-section>

          {/* Live Preview */}
          <s-section heading="Live Preview">
            <div style={{ background: previewBg, borderRadius: "10px", padding: "20px", border: "1px solid #e1e3e5", maxWidth: "480px" }}>
              {showStarRating && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "32px", fontWeight: 800, color: previewText }}>4.8</span>
                    <div>
                      <div style={{ color: "#f4a423", fontSize: "18px" }}>★★★★★</div>
                      {showReviewCount && <div style={{ fontSize: "12px", color: previewSubText }}>Based on 128 reviews</div>}
                    </div>
                  </div>
                </div>
              )}
              <div style={{ borderTop: `1px solid ${widgetTheme === "dark" ? "rgba(255,255,255,0.1)" : "#e1e3e5"}`, paddingTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: "14px", color: previewText }}>Priya S.</span>
                    {showVerifiedBadge && <span style={{ marginLeft: "8px", fontSize: "11px", color: "#008060", fontWeight: 600 }}>✓ Verified</span>}
                  </div>
                  <span style={{ color: "#f4a423" }}>★★★★★</span>
                </div>
                <div style={{ fontSize: "13px", color: previewSubText, lineHeight: 1.6 }}>
                  Amazing product! Exactly as described and arrived quickly. Highly recommended!
                </div>
                {showPhotos && (
                  <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                    {[1, 2].map(i => (
                      <div key={i} style={{ width: 48, height: 48, borderRadius: 6, background: primaryColor, opacity: 0.3 }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </s-section>
        </>
      )}

      {/* Collection Tab */}
      {activeTab === "collection" && (
        <s-section heading="Review Collection Settings" description="Control what types of reviews customers can submit.">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { label: "Allow photo reviews", hint: "Customers can upload photos with their review", value: allowPhotos, set: setAllowPhotos },
              { label: "Allow video reviews", hint: "Customers can upload video reviews (paid feature)", value: allowVideos, set: setAllowVideos },
              { label: "Enable Q&A", hint: "Allow customers to ask questions on product pages", value: qaEnabled, set: setQaEnabled },
            ].map(item => (
              <div key={item.label} style={rowStyle}>
                <div>
                  <div style={labelStyle}>{item.label}</div>
                  <div style={hintStyle}>{item.hint}</div>
                </div>
                <label style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={item.value} onChange={e => item.set(e.target.checked)} style={{ display: "none" }} />
                  <div style={{ ...toggleStyle, background: item.value ? "#008060" : "#c9cccf" }}>
                    <div style={{ ...toggleDotStyle, transform: item.value ? "translateX(20px)" : "translateX(2px)" }} />
                  </div>
                </label>
              </div>
            ))}
          </div>
        </s-section>
      )}

      {/* SEO Tab */}
      {activeTab === "seo" && (
        <s-section heading="SEO Settings" description="Boost your search rankings with review rich snippets.">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={rowStyle}>
              <div>
                <div style={labelStyle}>Enable Google rich snippets</div>
                <div style={hintStyle}>Show star ratings in Google search results</div>
              </div>
              <label style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={seoEnabled} onChange={e => setSeoEnabled(e.target.checked)} style={{ display: "none" }} />
                <div style={{ ...toggleStyle, background: seoEnabled ? "#008060" : "#c9cccf" }}>
                  <div style={{ ...toggleDotStyle, transform: seoEnabled ? "translateX(20px)" : "translateX(2px)" }} />
                </div>
              </label>
            </div>
            {seoEnabled && (
              <div style={{ padding: "14px 16px", background: "#f1f8f5", border: "1px solid #008060", borderRadius: "8px", fontSize: "13px" }}>
                <strong style={{ color: "#008060" }}>✓ Google Rich Snippets Active</strong>
                <div style={{ color: "#6d7175", marginTop: "4px" }}>
                  Your product pages will show star ratings in Google search results. This can increase click-through rates by 15-30%.
                </div>
              </div>
            )}
          </div>
        </s-section>
      )}

      {/* Placements Tab */}
      {activeTab === "placements" && (
        <s-section heading="Widget Placements" description="Choose where to display review widgets on your store.">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { label: "Product page — Review list", desc: "Full review list below product description", active: true },
              { label: "Product page — Star rating", desc: "Star rating badge near product title", active: true },
              { label: "Homepage — Featured reviews", desc: "Showcase top reviews on your homepage", active: false },
              { label: "Collection page — Star badges", desc: "Show ratings on product cards", active: true },
              { label: "Cart — Review snippet", desc: "Show product rating in cart drawer", active: false },
            ].map(p => (
              <div key={p.label} style={{ ...rowStyle, opacity: p.active ? 1 : 0.6 }}>
                <div>
                  <div style={labelStyle}>{p.label}</div>
                  <div style={hintStyle}>{p.desc}</div>
                </div>
                <span style={{
                  fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "99px",
                  background: p.active ? "#e3f1eb" : "#f6f6f7",
                  color: p.active ? "#008060" : "#6d7175",
                }}>
                  {p.active ? "Active" : "Via theme editor"}
                </span>
              </div>
            ))}
            <div style={{ padding: "14px 16px", background: "#f0f7ff", border: "1px solid #b3d4ff", borderRadius: "8px", fontSize: "13px", color: "#0c4a8f" }}>
              💡 To add widgets to specific pages, go to <strong>Shopify Admin → Online Store → Themes → Customize</strong> and add the SuperBundle Pro app blocks.
            </div>
          </div>
        </s-section>
      )}

      <s-section slot="aside" heading="🎨 Widget Types">
        {[
          { name: "Review List", desc: "Full paginated review list" },
          { name: "Star Badge", desc: "Compact rating badge" },
          { name: "Review Carousel", desc: "Scrolling review slider" },
          { name: "Testimonial Grid", desc: "Grid layout for homepage" },
          { name: "Q&A Section", desc: "Questions and answers" },
        ].map(w => (
          <div key={w.name} style={{ padding: "8px 0", borderBottom: "1px solid #f1f1f1" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#202223" }}>{w.name}</div>
            <div style={{ fontSize: "12px", color: "#6d7175" }}>{w.desc}</div>
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
