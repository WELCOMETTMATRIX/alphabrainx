import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "./about";
import { TrustedBrands } from "@/components/TrustedBrands";

export const Route = createFileRoute("/disclaimer")({
  head: () => ({
    meta: [
      { title: "Risk Disclaimer — Alpha Brain" },
      { name: "description", content: "Risk disclaimer, data accuracy notice and provider list for Alpha Brain market intelligence." },
      { property: "og:title", content: "Risk Disclaimer — Alpha Brain" },
      { property: "og:description", content: "Risk disclaimer and data accuracy notice for Alpha Brain." },
    ],
  }),
  component: () => (
    <LegalShell title="Risk Disclaimer">
      <p><em>Last updated: 2026</em></p>
      <p>This page is maintained by the Alpha Brain team to make the limits of the product explicit.</p>
      <h2>Not investment advice</h2>
      <p>Alpha Brain is an analysis tool. Its AI outputs, scans, backtests and price targets are statistical interpretations of public market data — not recommendations, solicitations, or personalised advice.</p>
      <h2>Data accuracy</h2>
      <p>Quotes, candles and on-chain metrics are relayed from third-party APIs. They can be delayed, rate-limited, revised or briefly unavailable. Always confirm on your exchange or broker before acting.</p>
      <h2>Backtests are hypothetical</h2>
      <p>Backtest results are computed on historical candles without slippage, fees or liquidity constraints. Past performance never guarantees future results.</p>
      <h2>On-chain tokens</h2>
      <p>New DEX tokens carry extreme risk including rug pulls, honeypots and fake liquidity. Contract addresses shown are as reported by the data provider — verify independently.</p>
      <h2>Providers we rely on</h2>
      <TrustedBrands compact />
      <h2>Contact</h2>
      <p><a href="mailto:xapp431@gmail.com">xapp431@gmail.com</a></p>
    </LegalShell>
  ),
});
