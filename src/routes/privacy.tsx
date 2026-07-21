import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "./about";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Alpha Brain" },
      { name: "description", content: "How Alpha Brain handles your data — watchlists and alerts are stored locally on your device." },
    ],
  }),
  component: () => (
    <LegalShell title="Privacy Policy">
      <p><em>Last updated: 2026</em></p>
      <p>This page is maintained by the Alpha Brain team to explain how we handle information when you use the app.</p>
      <h2>What we collect</h2>
      <p>Alpha Brain does not require an account. Your watchlist, alerts and theme preference are stored in your browser's local storage on your device. We do not transmit them to our servers.</p>
      <h2>Server-side logs</h2>
      <p>Our serverless functions (market data, AI analysis) may log the IP address of each request temporarily for rate-limiting and abuse prevention. Logs are rotated automatically.</p>
      <h2>Third-party services</h2>
      <p>We forward requests to Finnhub, Crypto.com Exchange, DexScreener, GeckoTerminal and the Lovable AI Gateway. Their own privacy policies apply.</p>
      <h2>Cookies</h2>
      <p>Alpha Brain does not use tracking cookies or third-party analytics.</p>
      <h2>Children</h2>
      <p>Alpha Brain is not directed to children under 13.</p>
      <h2>Contact</h2>
      <p>Questions? Email <a href="mailto:xapp431@gmail.com">xapp431@gmail.com</a>.</p>
    </LegalShell>
  ),
});
