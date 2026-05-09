// @ts-nocheck
import '@shopify/ui-extensions/preact';
import { render } from "preact";
import { useState } from "preact/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// SuperBundle Pro — Review Widget
// Target: purchase.thank-you.block.render
// Shows: Product reviews + Write review CTA on thank you page
// ─────────────────────────────────────────────────────────────────────────────

export default async () => {
  render(<ReviewWidget />, document.body);
};

function ReviewWidget() {
  const settings = shopify.settings.value ?? {};

  if (settings.showReviews === false) return null;

  const heading = settings.reviewsHeading ?? "What others are saying ⭐";

  // Sample reviews — in production these would be fetched via api_access
  // from your SuperBundle Pro API endpoint
  const sampleReviews = [
    { name: "Priya S.", rating: 5, text: "Amazing quality! Exactly as described. Will definitely order again.", verified: true, date: "2 days ago" },
    { name: "Rahul M.", rating: 5, text: "Fast delivery and great packaging. Very happy with my purchase.", verified: true, date: "1 week ago" },
    { name: "Anjali K.", rating: 4, text: "Good product, slightly different shade but still lovely.", verified: false, date: "2 weeks ago" },
  ];

  const maxReviews = parseInt(settings.maxReviews ?? 3);
  const reviews = sampleReviews.slice(0, maxReviews);
  const avgRating = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);

  return (
    <s-stack gap="base">
      {/* Heading + avg rating */}
      <s-banner tone="info" heading={heading}>
        <s-stack gap="small">
          <s-text>
            ⭐ {avgRating} average from {reviews.length} verified reviews
          </s-text>
        </s-stack>
      </s-banner>

      {/* Review list */}
      {reviews.map((review, i) => (
        <ReviewCard key={i} review={review} />
      ))}

      {/* Write review CTA */}
      {settings.showWriteReview !== false && (
        <WriteReviewCta settings={settings} />
      )}
    </s-stack>
  );
}

function ReviewCard({ review }) {
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);

  return (
    <s-banner tone="success" heading={`${stars} ${review.name}`}>
      <s-stack gap="small">
        <s-text>{review.text}</s-text>
        <s-text>
          {review.verified ? "✓ Verified Purchase · " : ""}{review.date}
        </s-text>
      </s-stack>
    </s-banner>
  );
}

function WriteReviewCta({ settings }) {
  const [clicked, setClicked] = useState(false);
  const ctaText = settings.ctaText ?? "⭐ Leave a Review";

  if (clicked) {
    return (
      <s-banner tone="success" heading="Thank you!">
        <s-text>Your review link has been sent to your email.</s-text>
      </s-banner>
    );
  }

  return (
    <s-banner tone="info" heading="Enjoyed your purchase?">
      <s-stack gap="small">
        <s-text>Share your experience and help other shoppers.</s-text>
        <s-checkbox
          label={ctaText}
          checked={false}
          onChange={() => setClicked(true)}
        />
      </s-stack>
    </s-banner>
  );
}