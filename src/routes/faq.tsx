import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "./about";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Alpha Brain" },
      { name: "description", content: "Frequently asked questions about Alpha Brain, its data sources, AI brain, alerts, backtesting and desktop app." },
    ],
  }),
  component: () => (
    <LegalShell title="Frequently Asked Questions">
      <h2>What data sources power Alpha Brain?</h2>
      <p>Stocks: Finnhub. Crypto: Crypto.com Exchange public market data. On-chain: DexScreener + GeckoTerminal across 30+ chains (Ethereum, Solana, Cronos, Base, BSC, and more).</p>
      <h2>Is the AI giving financial advice?</h2>
      <p>No. The AI is an analysis assistant. It surfaces technical patterns, regimes and probabilities. You are always responsible for your own trades.</p>
      <h2>How do alerts work?</h2>
      <p>Set a target price on any asset — Alpha Brain polls live quotes every 5 seconds and notifies you the instant a level is crossed.</p>
      <h2>Can I backtest a strategy?</h2>
      <p>Yes. Open the AI Analyst → Backtest. Choose SMA Cross, MACD Trend or RSI Reversion and replay against loaded candles. You'll get total return, alpha vs buy-and-hold, win rate, drawdown, Sharpe, and an AI verdict.</p>
      <h2>Is there a desktop app?</h2>
      <p>Yes — a Windows build is available on the <a href="/download">Download</a> page.</p>
      <h2>Is Alpha Brain free?</h2>
      <p>Alpha Brain is currently free. AI usage is rate-limited to keep the service sustainable.</p>
    </LegalShell>
  ),
});
