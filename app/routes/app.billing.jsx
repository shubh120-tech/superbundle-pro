import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

const PLANS = [
  {
    id: "free", name: "Free", monthlyPrice: 0, annualPrice: 0, color: "#6d7175", badge: null,
    features: ["Product Reviews (basic)", "Smart Cart (basic)", "100 orders/month", "Email support"],
    notIncluded: ["Video widgets", "Photo reviews", "Milestone rewards", "Advanced analytics"],
  },
  {
    id: "starter", name: "Starter", monthlyPrice: 499, annualPrice: 399, color: "#008060", badge: null, trialDays: 14,
    features: ["All Free features", "Photo reviews", "Milestone rewards", "Shoppable Videos (5 videos)", "500 orders/month", "Priority support"],
    notIncluded: ["Video reviews", "Unlimited videos", "Advanced upsell rules"],
  },
  {
    id: "pro", name: "Pro", monthlyPrice: 999, annualPrice: 799, color: "#5C6AC4", badge: "⭐ Most Popular", trialDays: 14,
    features: ["All Starter features", "Video reviews", "Unlimited shoppable videos", "Advanced upsell rules", "Freebie selector", "Smart discount codes", "2,000 orders/month", "Analytics dashboard"],
    notIncluded: [],
  },
  {
    id: "enterprise", name: "Enterprise", monthlyPrice: 2499, annualPrice: 1999, color: "#202223", badge: "🚀 Best Value", trialDays: 14,
    features: ["Everything in Pro", "Unlimited orders", "Custom branding", "Dedicated account manager", "API access", "SLA support"],
    notIncluded: [],
  },
];

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  let currentSubscription = null;
  let activePlanId = "free";
  try {
    const res = await admin.graphql(`
      query { currentAppInstallation { activeSubscriptions { id name status trialDays createdAt currentPeriodEnd
        lineItems { plan { pricingDetails { ... on AppRecurringPricing { price { amount currencyCode } interval } } } }
      } } }
    `);
    const data = await res.json();
    const subs = data?.data?.currentAppInstallation?.activeSubscriptions ?? [];
    if (subs.length > 0) {
      currentSubscription = subs[0];
      activePlanId = PLANS.find(p => currentSubscription.name.toLowerCase().includes(p.name.toLowerCase()))?.id ?? "free";
    }
  } catch (e) { console.warn("Billing API not available:", e.message); }
  return { currentSubscription, activePlanId };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const planId = formData.get("planId");
  const interval = formData.get("interval") ?? "EVERY_30_DAYS";

  if (intent === "subscribe") {
    const plan = PLANS.find(p => p.id === planId);
    if (!plan || plan.monthlyPrice === 0) return { success: false, message: "Invalid plan." };
    const price = interval === "ANNUAL" ? plan.annualPrice * 12 : plan.monthlyPrice;
    try {
      const res = await admin.graphql(`
        mutation createSub($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $trialDays: Int) {
          appSubscriptionCreate(name: $name returnUrl: $returnUrl trialDays: $trialDays lineItems: $lineItems test: true) {
            userErrors { field message }
            confirmationUrl
            appSubscription { id status }
          }
        }
      `, { variables: {
        name: `SuperBundle Pro — ${plan.name}`,
        trialDays: plan.trialDays ?? 0,
        returnUrl: `https://${session.shop}/admin/apps/superbundle-pro/app/billing?success=true`,
        lineItems: [{ plan: { appRecurringPricingDetails: { price: { amount: price, currencyCode: "INR" }, interval: interval === "ANNUAL" ? "ANNUAL" : "EVERY_30_DAYS" } } }],
      }});
      const data = await res.json();
      const result = data?.data?.appSubscriptionCreate;
      if (result?.userErrors?.length > 0) return { success: false, message: result.userErrors[0].message };
      return { success: true, confirmationUrl: result.confirmationUrl };
    } catch (e) { return { success: false, message: "Billing API requires public app distribution." }; }
  }
  return { success: false, message: "Unknown action." };
};

export default function BillingPage() {
  const { currentSubscription, activePlanId } = useLoaderData();
  const fetcher = useFetcher();
  const isSaving = fetcher.state === "submitting";
  const [interval, setIntervalVal] = useState("EVERY_30_DAYS");

  if (fetcher.data?.confirmationUrl) window.location.href = fetcher.data.confirmationUrl;

  const handleSubscribe = (planId) => {
    fetcher.submit({ intent: "subscribe", planId, interval }, { method: "POST" });
  };

  return (
    <s-page heading="Plan & Billing">
      {fetcher.data?.success === false && <s-banner tone="critical">{fetcher.data.message}</s-banner>}
      {fetcher.data?.success && !fetcher.data.confirmationUrl && <s-banner tone="success">Processing...</s-banner>}

      {currentSubscription && (
        <s-section>
          <div style={{ padding: "16px 20px", borderRadius: "10px", background: "#f1f8f5", border: "1px solid #008060", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "28px" }}>✅</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#202223" }}>{currentSubscription.name}</div>
                <div style={{ fontSize: "12px", color: "#6d7175" }}>
                  Active — renews {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            </div>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#008060", background: "#e3f1eb", padding: "4px 12px", borderRadius: "99px" }}>ACTIVE</span>
          </div>
        </s-section>
      )}

      {/* Billing toggle */}
      <s-section>
        <div style={{ display: "flex", justifyContent: "center" }}>
          {[["EVERY_30_DAYS", "Monthly"], ["ANNUAL", "Annual (Save 20%)"]].map(([v, l]) => (
            <button key={v} onClick={() => setIntervalVal(v)} style={{
              padding: "8px 24px", border: "1px solid #c9cccf", cursor: "pointer", fontSize: "13px",
              fontWeight: interval === v ? 700 : 400,
              background: interval === v ? "#202223" : "white",
              color: interval === v ? "white" : "#202223",
              borderRadius: v === "EVERY_30_DAYS" ? "6px 0 0 6px" : "0 6px 6px 0",
              borderLeft: v === "ANNUAL" ? "none" : undefined,
            }}>{l}</button>
          ))}
        </div>
      </s-section>

      {/* Plan cards */}
      <s-section heading="Choose Your Plan">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
          {PLANS.map(plan => {
            const isActive = activePlanId === plan.id;
            const price = interval === "ANNUAL" ? plan.annualPrice : plan.monthlyPrice;
            return (
              <div key={plan.id} style={{ border: `2px solid ${isActive ? plan.color : "#e1e3e5"}`, borderRadius: "12px", padding: "20px", background: isActive ? `${plan.color}06` : "white", position: "relative" }}>
                {plan.badge && (
                  <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: plan.color, color: "white", fontSize: "11px", fontWeight: 700, padding: "3px 12px", borderRadius: "99px", whiteSpace: "nowrap" }}>{plan.badge}</div>
                )}
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#202223", marginBottom: "6px" }}>{plan.name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "28px", fontWeight: 800, color: plan.color }}>{price === 0 ? "Free" : `₹${price.toLocaleString("en-IN")}`}</span>
                  {price > 0 && <span style={{ fontSize: "12px", color: "#6d7175" }}>/{interval === "ANNUAL" ? "mo" : "month"}</span>}
                </div>
                {plan.trialDays && !isActive && <div style={{ fontSize: "12px", color: "#6d7175", marginBottom: "12px" }}>{plan.trialDays}-day free trial</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
                  {plan.features.map(f => <div key={f} style={{ display: "flex", gap: "6px", fontSize: "12px" }}><span style={{ color: plan.color }}>✓</span><span style={{ color: "#202223" }}>{f}</span></div>)}
                  {plan.notIncluded?.map(f => <div key={f} style={{ display: "flex", gap: "6px", fontSize: "12px" }}><span style={{ color: "#c9cccf" }}>✗</span><span style={{ color: "#c9cccf" }}>{f}</span></div>)}
                </div>
                {isActive ? (
                  <button disabled style={{ width: "100%", padding: "9px", borderRadius: "7px", border: `2px solid ${plan.color}`, fontSize: "12px", fontWeight: 700, background: plan.color, color: "white", cursor: "default" }}>✓ Current Plan</button>
                ) : price === 0 ? (
                  <button disabled style={{ width: "100%", padding: "9px", borderRadius: "7px", border: "1px solid #e1e3e5", fontSize: "12px", fontWeight: 600, background: "#f6f6f7", color: "#6d7175", cursor: "default" }}>Free Forever</button>
                ) : (
                  <button onClick={() => handleSubscribe(plan.id)} disabled={isSaving} style={{ width: "100%", padding: "9px", borderRadius: "7px", border: "none", fontSize: "12px", fontWeight: 700, background: plan.color, color: "white", cursor: "pointer", opacity: isSaving ? 0.7 : 1 }}>
                    {isSaving ? "Processing..." : `Start ${plan.trialDays}-Day Trial`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </s-section>

      <s-section slot="aside" heading="💳 Billing Info">
        {[
          { label: "Current plan", value: activePlanId.charAt(0).toUpperCase() + activePlanId.slice(1) },
          { label: "Billing via", value: "Shopify Payments" },
          { label: "Next renewal", value: currentSubscription ? new Date(currentSubscription.currentPeriodEnd).toLocaleDateString("en-IN") : "—" },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f1f1", fontSize: "13px" }}>
            <span style={{ color: "#6d7175" }}>{s.label}</span>
            <span style={{ fontWeight: 600 }}>{s.value}</span>
          </div>
        ))}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
