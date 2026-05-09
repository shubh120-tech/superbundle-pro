import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">🏠 Dashboard</s-link>
        <s-link href="/app/analytics">📊 Analytics</s-link>
        <s-link href="/app/reviews">⭐ Reviews</s-link>
        <s-link href="/app/reviews/requests">📧 Review Requests</s-link>
        <s-link href="/app/reviews/widgets">🎨 Review Widgets</s-link>
        <s-link href="/app/reviews/import">📥 Import Reviews</s-link>
        <s-link href="/app/smart-cart">🛒 Smart Cart</s-link>
        <s-link href="/app/smart-cart/upsell">📈 Upsell Rules</s-link>
        <s-link href="/app/smart-cart/milestones">🏆 Milestones</s-link>
        <s-link href="/app/smart-cart/cod">💵 COD Settings</s-link>
        <s-link href="/app/videos">🎥 Videos</s-link>
        <s-link href="/app/videos/widgets">📱 Video Widgets</s-link>
        <s-link href="/app/videos/import">⬇️ Import Videos</s-link>
        <s-link href="/app/settings">⚙️ Settings</s-link>
        <s-link href="/app/billing">💎 Billing</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};