// @ts-nocheck
import '@shopify/ui-extensions/preact';
import { render } from "preact";
import { useState } from "preact/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// SuperBundle Pro — Cart Widget
// Target: purchase.thank-you.block.render
// Features: Free Shipping Bar, Milestone Rewards, Prepaid Nudge, Trust Badges
// ─────────────────────────────────────────────────────────────────────────────

export default async () => {
  render(<CartWidget />, document.body);
};

function CartWidget() {
  const settings = shopify.settings.value ?? {};
  const cost = shopify.cost?.subtotalAmount?.value;
  const cartTotal = cost?.amount ?? 0;
  const currency = cost?.currencyCode ?? "INR";

  const fmt = (n) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <s-stack gap="base">
      <FreeShippingBar cartTotal={cartTotal} settings={settings} fmt={fmt} />
      <MilestoneRewards cartTotal={cartTotal} settings={settings} fmt={fmt} />
      <PrepaidNudge settings={settings} fmt={fmt} />
      <TrustBadges settings={settings} />
    </s-stack>
  );
}

// ── Free Shipping Bar ─────────────────────────────────────────────────────────
function FreeShippingBar({ cartTotal, settings, fmt }) {
  if (settings.freeShippingEnabled === false) return null;

  const threshold = parseFloat(settings.freeShippingThreshold ?? 499);
  const remaining = Math.max(0, threshold - cartTotal);
  const progress = Math.min(100, Math.round((cartTotal / threshold) * 100));
  const isUnlocked = remaining === 0;

  const msg = isUnlocked
    ? (settings.freeShippingSuccessMessage ?? "🎉 You unlocked FREE shipping on your next order!")
    : (settings.freeShippingMessage ?? "Add {amount} more for FREE shipping 🚚")
        .replace("{amount}", fmt(remaining));

  return (
    <s-banner tone={isUnlocked ? "success" : "info"} heading={msg}>
      {!isUnlocked && (
        <s-text>{progress}% of the way there</s-text>
      )}
    </s-banner>
  );
}

// ── Milestone Rewards ─────────────────────────────────────────────────────────
function MilestoneRewards({ cartTotal, settings, fmt }) {
  if (settings.milestonesEnabled === false) return null;

  let milestones = [];
  try {
    milestones = JSON.parse(settings.milestones ?? "[]");
  } catch {
    milestones = [
      { threshold: 500,  reward: "Free Gift",            description: "Mystery gift added" },
      { threshold: 999,  reward: "10% OFF",              description: "Discount at checkout" },
      { threshold: 1999, reward: "Free Express Shipping", description: "1-2 day delivery" },
    ];
  }

  if (milestones.length === 0) return null;

  const next = milestones.find(m => m.threshold > cartTotal);
  const unlocked = milestones.filter(m => m.threshold <= cartTotal);

  if (!next && unlocked.length === 0) return null;

  return (
    <s-banner tone="info" heading="🏆 Milestone Rewards">
      <s-stack gap="small">
        {unlocked.map((m, i) => (
          <s-text key={i}>✅ {m.reward} unlocked — {m.description}</s-text>
        ))}
        {next && (
          <s-text>
            🔒 Add {fmt(next.threshold - cartTotal)} more to unlock {next.reward}
          </s-text>
        )}
      </s-stack>
    </s-banner>
  );
}

// ── Prepaid Nudge ─────────────────────────────────────────────────────────────
function PrepaidNudge({ settings, fmt }) {
  if (settings.prepaidNudgeEnabled === false) return null;

  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const discount = settings.prepaidDiscount ?? 50;
  const discountType = settings.prepaidDiscountType ?? "flat";
  const discountLabel = discountType === "flat"
    ? `${fmt(discount)} off`
    : `${discount}% off`;

  return (
    <s-banner
      tone="success"
      heading={`💳 Pay online & save ${discountLabel} on your next order!`}
      onDismiss={() => setDismissed(true)}
    >
      <s-text>Switch from COD to online payment for an instant discount.</s-text>
    </s-banner>
  );
}

// ── Trust Badges ──────────────────────────────────────────────────────────────
function TrustBadges({ settings }) {
  if (settings.trustBadgesEnabled === false) return null;

  return (
    <s-stack direction="inline" gap="base">
      <s-text>🔒 Secure</s-text>
      <s-text>🚚 Easy Returns</s-text>
      <s-text>✅ Safe Pay</s-text>
      <s-text>⭐ 4.8 Rated</s-text>
    </s-stack>
  );
}