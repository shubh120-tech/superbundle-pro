// @ts-nocheck
import '@shopify/ui-extensions/preact';
import { render } from "preact";
import { useState } from "preact/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// SuperBundle Pro — Video Widget
// Target: purchase.thank-you.block.render
// Shows: Shoppable video thumbnails with product tags on thank you page
// ─────────────────────────────────────────────────────────────────────────────

export default async () => {
  render(<VideoWidget />, document.body);
};

function VideoWidget() {
  const settings = shopify.settings.value ?? {};

  if (settings.videosEnabled === false) return null;

  const heading = settings.widgetHeading ?? "🎥 Watch & Shop";

  // Parse video URLs from settings
  let videos = [];
  try {
    videos = JSON.parse(settings.videoUrls ?? "[]");
  } catch {
    videos = [];
  }

  if (videos.length === 0) {
    // Show placeholder when no videos configured
    return (
      <s-banner tone="info" heading={heading}>
        <s-text>
          Configure your shoppable videos in the SuperBundle Pro app → Shoppable Videos → Import.
        </s-text>
      </s-banner>
    );
  }

  return (
    <s-stack gap="base">
      <s-banner tone="info" heading={heading}>
        <s-stack gap="small">
          <s-text>See your products in action — tap to shop!</s-text>
          {videos.slice(0, 3).map((video, i) => (
            <VideoCard key={i} video={video} index={i} settings={settings} />
          ))}
        </s-stack>
      </s-banner>
    </s-stack>
  );
}

function VideoCard({ video, index, settings }) {
  const [playing, setPlaying] = useState(false);

  const title = typeof video === "string" ? `Video ${index + 1}` : (video.title ?? `Video ${index + 1}`);
  const url = typeof video === "string" ? video : video.url;
  const productTag = typeof video === "object" && video.product ? video.product : null;

  return (
    <s-stack gap="small">
      <s-text>
        🎬 {title}
        {productTag && settings.showProductTags !== false ? ` · 🛍️ ${productTag}` : ""}
      </s-text>
      {!playing ? (
        <s-checkbox
          label={`▶ Play ${title}`}
          checked={false}
          onChange={() => setPlaying(true)}
        />
      ) : (
        <s-text>✅ Opening video... Visit our store to watch!</s-text>
      )}
    </s-stack>
  );
}