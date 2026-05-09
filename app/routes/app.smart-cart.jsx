import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  let settings = null;
  let stats = { cartEvents: 0, upsellAdded: 0, freebieSelected: 0, prepaidSwitched: 0, discountApplied: 0 };
  try {
    const [s, events] = await Promise.all([
      db.smartCartSettings.findUnique({ where: { shop: session.shop } }),
      db.cartEvent.groupBy({ by: ["event"], where: { shop: session.shop }, _count: { event: true } }),
    ]);
    settings = s;
    events.forEach(e => {
      if (e.event === "upsell_added") stats.upsellAdded = e._count.event;
      if (e.event === "freebie_selected") stats.freebieSelected = e._count.event;
      if (e.event === "prepaid_switched") stats.prepaidSwitched = e._count.event;
      if (e.event === "discount_applied") stats.discountApplied = e._count.event;
      stats.cartEvents += e._count.event;
    });
  } catch (e) { console.warn("DB query failed:", e.message); }
  return { settings, stats };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  const parsed = {
    cartDrawerEnabled: data.cartDrawerEnabled === "true",
    drawerPosition: data.drawerPosition || "right",
    primaryColor: data.primaryColor || "#008060",
    accentColor: data.accentColor || "#5C6AC4",
    cartTitle: data.cartTitle || "Your Cart",
    showCartCount: data.showCartCount === "true",
    freeShippingEnabled: data.freeShippingEnabled === "true",
    freeShippingThreshold: parseFloat(data.freeShippingThreshold || 499),
    freeShippingMessage: data.freeShippingMessage || "Add {amount} more for FREE shipping 🚚",
    freeShippingSuccessMsg: data.freeShippingSuccessMsg || "🎉 You unlocked FREE shipping!",
    announcementEnabled: data.announcementEnabled === "true",
    announcementText: data.announcementText || "",
    announcementColor: data.announcementColor || "#008060",
    prepaidNudgeEnabled: data.prepaidNudgeEnabled === "true",
    prepaidDiscount: parseFloat(data.prepaidDiscount || 50),
    prepaidDiscountType: data.prepaidDiscountType || "flat",
    trustBadgesEnabled: data.trustBadgesEnabled === "true",
  };
  try {
    await db.smartCartSettings.upsert({
      where: { shop: session.shop },
      update: parsed,
      create: { shop: session.shop, ...parsed },
    });
  } catch (e) { return { success: false, message: e.message }; }
  return { success: true };
};

export default function SmartCartPage() {
  const { settings: s, stats } = useLoaderData();
  const fetcher = useFetcher();
  const isSaving = fetcher.state === "submitting";

  const [cartDrawerEnabled, setCartDrawerEnabled] = useState(s?.cartDrawerEnabled ?? true);
  const [drawerPosition, setDrawerPosition] = useState(s?.drawerPosition ?? "right");
  const [primaryColor, setPrimaryColor] = useState(s?.primaryColor ?? "#008060");
  const [accentColor, setAccentColor] = useState(s?.accentColor ?? "#5C6AC4");
  const [cartTitle, setCartTitle] = useState(s?.cartTitle ?? "Your Cart");
  const [showCartCount, setShowCartCount] = useState(s?.showCartCount ?? true);
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(s?.freeShippingEnabled ?? true);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(s?.freeShippingThreshold ?? 499);
  const [freeShippingMessage, setFreeShippingMessage] = useState(s?.freeShippingMessage ?? "Add {amount} more for FREE shipping 🚚");
  const [freeShippingSuccessMsg, setFreeShippingSuccessMsg] = useState(s?.freeShippingSuccessMsg ?? "🎉 You unlocked FREE shipping!");
  const [announcementEnabled, setAnnouncementEnabled] = useState(s?.announcementEnabled ?? false);
  const [announcementText, setAnnouncementText] = useState(s?.announcementText ?? "");
  const [announcementColor, setAnnouncementColor] = useState(s?.announcementColor ?? "#008060");
  const [prepaidNudgeEnabled, setPrepaidNudgeEnabled] = useState(s?.prepaidNudgeEnabled ?? true);
  const [prepaidDiscount, setPrepaidDiscount] = useState(s?.prepaidDiscount ?? 50);
  const [prepaidDiscountType, setPrepaidDiscountType] = useState(s?.prepaidDiscountType ?? "flat");
  const [trustBadgesEnabled, setTrustBadgesEnabled] = useState(s?.trustBadgesEnabled ?? true);
  const [activeTab, setActiveTab] = useState("cart");

  const handleSave = () => {
    fetcher.submit({
      cartDrawerEnabled: String(cartDrawerEnabled), drawerPosition,
      primaryColor, accentColor, cartTitle, showCartCount: String(showCartCount),
      freeShippingEnabled: String(freeShippingEnabled), freeShippingThreshold,
      freeShippingMessage, freeShippingSuccessMsg,
      announcementEnabled: String(announcementEnabled), announcementText, announcementColor,
      prepaidNudgeEnabled: String(prepaidNudgeEnabled), prepaidDiscount, prepaidDiscountType,
      trustBadgesEnabled: String(trustBadgesEnabled),
    }, { method: "POST" });
  };

  const tabs = ["cart", "shipping", "announcement", "prepaid", "trust"];
  const tabLabels = { cart: "🛒 Cart Drawer", shipping: "🚚 Free Shipping", announcement: "📢 Banner", prepaid: "💳 Prepaid Nudge", trust: "✅ Trust Badges" };

  return (
    <s-page heading="Smart Cart">
      <s-button slot="primary-action" onClick={handleSave} {...(isSaving ? { loading: true } : {})}>
        {isSaving ? "Saving..." : "Save Settings"}
      </s-button>
      {fetcher.data?.success && <s-banner tone="success">Smart Cart settings saved!</s-banner>}

      {/* Stats */}
      <s-section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
          {[
            { label: "Cart Events", value: stats.cartEvents, icon: "🛒" },
            { label: "Upsell Added", value: stats.upsellAdded, icon: "📈" },
            { label: "Prepaid Switched", value: stats.prepaidSwitched, icon: "💳" },
            { label: "Discounts Applied", value: stats.discountApplied, icon: "🏷️" },
          ].map(s => (
            <div key={s.label} style={{ background: "#f6f6f7", borderRadius: "10px", padding: "16px", border: "1px solid #e1e3e5" }}>
              <div style={{ fontSize: "22px", marginBottom: "6px" }}>{s.icon}</div>
              <div style={{ fontSize: "22px", fontWeight: 700, color: "#202223" }}>{s.value}</div>
              <div style={{ fontSize: "12px", color: "#6d7175", marginTop: "2px" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </s-section>

      {/* Tabs */}
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

      {activeTab === "cart" && (
        <s-section heading="Cart Drawer Settings">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={rowStyle}>
              <div><div style={labelStyle}>Enable cart drawer</div><div style={hintStyle}>Show a slide-out cart instead of redirecting to cart page</div></div>
              <label style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={cartDrawerEnabled} onChange={e => setCartDrawerEnabled(e.target.checked)} style={{ display: "none" }} />
                <div style={{ ...toggleStyle, background: cartDrawerEnabled ? "#008060" : "#c9cccf" }}><div style={{ ...toggleDotStyle, transform: cartDrawerEnabled ? "translateX(20px)" : "translateX(2px)" }} /></div>
              </label>
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Cart title</label>
              <input type="text" value={cartTitle} onChange={e => setCartTitle(e.target.value)} style={{ ...inputStyle, maxWidth: "240px" }} />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Drawer position</label>
              <div style={{ display: "flex", gap: "12px" }}>
                {["right", "left"].map(p => (
                  <button key={p} onClick={() => setDrawerPosition(p)} style={{
                    padding: "8px 20px", borderRadius: "7px", cursor: "pointer", fontSize: "13px",
                    border: `2px solid ${drawerPosition === p ? primaryColor : "#e1e3e5"}`,
                    background: drawerPosition === p ? `${primaryColor}10` : "white",
                    color: drawerPosition === p ? primaryColor : "#6d7175",
                    fontWeight: drawerPosition === p ? 600 : 400, textTransform: "capitalize",
                  }}>{p}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Primary color</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ width: "44px", height: "36px", border: "1px solid #c9cccf", borderRadius: "6px", cursor: "pointer" }} />
                  <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ ...inputStyle, fontFamily: "monospace" }} />
                </div>
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Accent color</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} style={{ width: "44px", height: "36px", border: "1px solid #c9cccf", borderRadius: "6px", cursor: "pointer" }} />
                  <input type="text" value={accentColor} onChange={e => setAccentColor(e.target.value)} style={{ ...inputStyle, fontFamily: "monospace" }} />
                </div>
              </div>
            </div>
            <div style={rowStyle}>
              <div><div style={labelStyle}>Show cart item count badge</div><div style={hintStyle}>Display item count on cart icon</div></div>
              <label style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={showCartCount} onChange={e => setShowCartCount(e.target.checked)} style={{ display: "none" }} />
                <div style={{ ...toggleStyle, background: showCartCount ? "#008060" : "#c9cccf" }}><div style={{ ...toggleDotStyle, transform: showCartCount ? "translateX(20px)" : "translateX(2px)" }} /></div>
              </label>
            </div>
          </div>
        </s-section>
      )}

      {activeTab === "shipping" && (
        <s-section heading="Free Shipping Bar" description="Show a progress bar to encourage customers to reach free shipping threshold.">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={rowStyle}>
              <div><div style={labelStyle}>Enable free shipping bar</div><div style={hintStyle}>Show progress toward free shipping in cart</div></div>
              <label style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={freeShippingEnabled} onChange={e => setFreeShippingEnabled(e.target.checked)} style={{ display: "none" }} />
                <div style={{ ...toggleStyle, background: freeShippingEnabled ? "#008060" : "#c9cccf" }}><div style={{ ...toggleDotStyle, transform: freeShippingEnabled ? "translateX(20px)" : "translateX(2px)" }} /></div>
              </label>
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Free shipping threshold (₹)</label>
              <input type="number" value={freeShippingThreshold} onChange={e => setFreeShippingThreshold(Number(e.target.value))} style={{ ...inputStyle, maxWidth: "180px" }} />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Progress message</label>
              <input type="text" value={freeShippingMessage} onChange={e => setFreeShippingMessage(e.target.value)} style={inputStyle} />
              <div style={hintStyle}>Use {"{amount}"} for the remaining amount</div>
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Success message</label>
              <input type="text" value={freeShippingSuccessMsg} onChange={e => setFreeShippingSuccessMsg(e.target.value)} style={inputStyle} />
            </div>
            {/* Preview */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Preview</label>
              <div style={{ background: "#f6f6f7", borderRadius: "10px", padding: "16px", maxWidth: "400px", border: "1px solid #e1e3e5" }}>
                <div style={{ fontSize: "13px", color: "#202223", marginBottom: "8px" }}>
                  {freeShippingMessage.replace("{amount}", "₹200")}
                </div>
                <div style={{ height: "8px", background: "#e1e3e5", borderRadius: "4px" }}>
                  <div style={{ height: "100%", width: "60%", background: primaryColor, borderRadius: "4px" }} />
                </div>
                <div style={{ fontSize: "11px", color: "#6d7175", marginTop: "4px" }}>60% of the way there</div>
              </div>
            </div>
          </div>
        </s-section>
      )}

      {activeTab === "announcement" && (
        <s-section heading="In-Cart Announcement Banner" description="Show a promotional banner inside the cart drawer.">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={rowStyle}>
              <div><div style={labelStyle}>Enable announcement banner</div><div style={hintStyle}>Show a banner at the top of the cart</div></div>
              <label style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={announcementEnabled} onChange={e => setAnnouncementEnabled(e.target.checked)} style={{ display: "none" }} />
                <div style={{ ...toggleStyle, background: announcementEnabled ? "#008060" : "#c9cccf" }}><div style={{ ...toggleDotStyle, transform: announcementEnabled ? "translateX(20px)" : "translateX(2px)" }} /></div>
              </label>
            </div>
            {announcementEnabled && (
              <>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Announcement text</label>
                  <input type="text" value={announcementText} onChange={e => setAnnouncementText(e.target.value)} placeholder="🎉 Free gift on orders above ₹999!" style={inputStyle} />
                </div>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Banner color</label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input type="color" value={announcementColor} onChange={e => setAnnouncementColor(e.target.value)} style={{ width: "44px", height: "36px", border: "1px solid #c9cccf", borderRadius: "6px", cursor: "pointer" }} />
                    <input type="text" value={announcementColor} onChange={e => setAnnouncementColor(e.target.value)} style={{ ...inputStyle, maxWidth: "140px", fontFamily: "monospace" }} />
                  </div>
                </div>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Preview</label>
                  <div style={{ padding: "12px 16px", background: announcementColor, borderRadius: "8px", color: "white", fontSize: "13px", fontWeight: 600, maxWidth: "400px" }}>
                    {announcementText || "Your announcement text here"}
                  </div>
                </div>
              </>
            )}
          </div>
        </s-section>
      )}

      {activeTab === "prepaid" && (
        <s-section heading="Prepaid COD Nudge" description="Encourage customers to switch from COD to prepaid with a discount.">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={rowStyle}>
              <div><div style={labelStyle}>Enable prepaid nudge</div><div style={hintStyle}>Show discount offer when customer selects COD</div></div>
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
          </div>
        </s-section>
      )}

      {activeTab === "trust" && (
        <s-section heading="Trust Badges" description="Show security badges to reduce checkout anxiety.">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={rowStyle}>
              <div><div style={labelStyle}>Enable trust badges</div><div style={hintStyle}>Show secure payment and return policy badges in cart</div></div>
              <label style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={trustBadgesEnabled} onChange={e => setTrustBadgesEnabled(e.target.checked)} style={{ display: "none" }} />
                <div style={{ ...toggleStyle, background: trustBadgesEnabled ? "#008060" : "#c9cccf" }}><div style={{ ...toggleDotStyle, transform: trustBadgesEnabled ? "translateX(20px)" : "translateX(2px)" }} /></div>
              </label>
            </div>
            {trustBadgesEnabled && (
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {["🔒 Secure Checkout", "🚚 Easy Returns", "✅ Safe Pay", "⭐ 4.8 Rated", "🛡️ Buyer Protection"].map(badge => (
                  <div key={badge} style={{ padding: "8px 16px", background: "#f6f6f7", borderRadius: "99px", fontSize: "13px", border: "1px solid #e1e3e5" }}>{badge}</div>
                ))}
              </div>
            )}
          </div>
        </s-section>
      )}

      <s-section slot="aside" heading="🔗 Quick Links">
        {[
          { label: "📈 Upsell Rules", href: "/app/smart-cart/upsell" },
          { label: "🏆 Milestone Rewards", href: "/app/smart-cart/milestones" },
          { label: "💵 COD Settings", href: "/app/smart-cart/cod" },
        ].map(l => (
          <div key={l.label} style={{ padding: "9px 0", borderBottom: "1px solid #f1f1f1" }}>
            <a href={l.href} style={{ fontSize: "13px", color: "#2c6ecb", textDecoration: "none", fontWeight: 500 }}>{l.label} →</a>
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
