import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "./about";
import { TrustedBrands } from "@/components/TrustedBrands";

export const Route = createFileRoute("/data-sources")({
  head: () => ({
    meta: [
      { title: "Data Sources & Disclosures — Alpha Brain" },
      { name: "description", content: "Exactly which market, on-chain, charting and intelligence sources Alpha Brain uses, with refresh rates, coverage limits and accuracy notes." },
      { property: "og:title", content: "Data Sources & Disclosures — Alpha Brain" },
      { property: "og:description", content: "Finnhub, Crypto.com, DexScreener, GeckoTerminal, TradingView charts and ScamWatch × Nova — coverage, limits and accuracy." },
    ],
  }),
  component: DataSourcesPage,
});

type Row = { field: string; value: string };

function Spec({ rows }: { rows: Row[] }) {
  return (
    <div className="not-prose my-3 overflow-hidden rounded-xl border border-white/10">
      {rows.map((r, i) => (
        <div key={r.field} className={`flex flex-col gap-0.5 p-3 sm:flex-row sm:gap-4 ${i % 2 ? "bg-white/[0.02]" : ""}`}>
          <span className="w-40 shrink-0 font-mono text-[10px] uppercase tracking-widest text-slate-500">{r.field}</span>
          <span className="text-xs leading-relaxed text-slate-300">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function DataSourcesPage() {
  return (
    <LegalShell title="Data Sources & Disclosures">
      <p><em>Last updated: 2026</em></p>
      <p>
        This page is maintained by the Alpha Brain team. It lists every live source behind the numbers you
        see, how often each refreshes, what it does <strong>not</strong> cover, and where inaccuracies are
        expected. Nothing in the app is simulated or back-filled with invented data: if a provider is down,
        the affected panel shows an error or the last cached value with its timestamp — it never fabricates
        prices.
      </p>

      <h2>1. Equities — Finnhub</h2>
      <Spec rows={[
        { field: "Used for", value: "US stock quotes, OHLC candles, company profiles, symbol search and the All Stocks browser." },
        { field: "Refresh", value: "Quotes poll about every 8 seconds while a panel is visible; candles are fetched per timeframe and cached briefly server-side." },
        { field: "Coverage limits", value: "Primarily US-listed tickers. Free-tier plans exclude several exchanges, some ETFs, pre/post-market depth and full order-book data." },
        { field: "Accuracy notes", value: "Quotes may be delayed depending on plan and exchange entitlements. Treat them as indicative, not execution-grade. Corporate actions (splits, dividends) can briefly distort candle history." },
      ]} />

      <h2>2. Centralised crypto — Crypto.com Exchange (public API)</h2>
      <Spec rows={[
        { field: "Used for", value: "Crypto tickers, 24h change, volume and candlesticks for the Crypto tab and crypto watchlist entries." },
        { field: "Refresh", value: "Ticker polling on the same ~8 second cadence, with a server cache to stay inside public rate limits." },
        { field: "Coverage limits", value: "Only pairs listed on that venue. Prices are venue-specific and can differ from other exchanges or from aggregate indexes." },
        { field: "Accuracy notes", value: "Thin pairs can print outlier wicks. No private account, balance or trading endpoints are used — the app is read-only." },
        { field: "Binance", value: "Earlier builds used Binance public endpoints. The pipeline now runs on Crypto.com public market data; no Binance keys or private endpoints are in use." },
      ]} />

      <h2>3. On-chain / DEX — DexScreener &amp; GeckoTerminal</h2>
      <Spec rows={[
        { field: "Used for", value: "Trending and newly-created pairs, liquidity, FDV, pool OHLCV, contract addresses and multi-chain discovery (Ethereum, Solana, Cronos, Base, BSC and more)." },
        { field: "Refresh", value: "Stale-while-revalidate caching: a cached list is shown instantly while a fresh request runs in the background, with fallback categories so lists are not left empty." },
        { field: "Coverage limits", value: "Indexers lag block production, and brand-new pools can appear before liquidity is meaningful. Some chains and DEXs are only partially indexed." },
        { field: "Accuracy notes", value: "Micro-cap prices come from pool ratios and can be manipulated by wash trading or single-sided liquidity. Always verify a contract address on a block explorer before interacting with it." },
      ]} />

      <h2>4. Charting — TradingView Lightweight Charts</h2>
      <Spec rows={[
        { field: "Used for", value: "Every candlestick, line and overlay in the app, including compare mode and the backtesting sandbox replay." },
        { field: "What it is", value: "An open-source rendering library. It draws the data we pass it — it is not a data feed and does not add its own prices." },
        { field: "Accuracy notes", value: "Indicators (RSI, MACD, ATR, SMA) are computed by Alpha Brain from provider candles. Different providers bucket candles differently, so values can differ slightly from other terminals." },
      ]} />

      <h2>5. Intelligence coverage — ScamWatch × Nova</h2>
      <Spec rows={[
        { field: "Used for", value: "The AI Intelligence Center: threat records, flagged wallets and contracts, impersonation and scam-campaign entries, and the copyable threat database." },
        { field: "Attribution", value: "Created & powered by ScamWatch × Nova (scamwatchnova.lovable.app). Records are free to read, copy and export." },
        { field: "Coverage limits", value: "Community and research driven. Absence of an address from the database is not evidence that it is safe, and inclusion is a risk signal — not a legal finding." },
        { field: "Accuracy notes", value: "Addresses can be reused, spoofed or recycled. Verify independently before acting, and report corrections to the contact address below." },
      ]} />

      <h2>6. AI reasoning — Lovable AI Gateway</h2>
      <Spec rows={[
        { field: "Used for", value: "AI Analyst reports, market scans, on-chain risk summaries and backtest commentary." },
        { field: "Inputs", value: "Only the market data already shown in the app (prices, candles, computed indicators) plus your typed question. No accounts, no personal profiles." },
        { field: "Limits", value: "Per-IP rate limiting and a daily global cap protect the service from abuse; when exhausted, the panel says so rather than returning stale or invented output." },
        { field: "Accuracy notes", value: "Language models can be confidently wrong. Probabilities and price targets are model estimates, not forecasts, and must never be treated as advice." },
      ]} />

      <h2>7. All providers at a glance</h2>
      <TrustedBrands />

      <h2>8. Corrections &amp; contact</h2>
      <p>
        Spotted a wrong price, a bad threat record or a stale panel? Email{" "}
        <a href="mailto:xapp431@gmail.com">xapp431@gmail.com</a> with the asset, timestamp and screenshot and we
        will investigate.
      </p>
      <p>
        Alpha Brain is an information tool, not a broker, exchange or adviser. See the{" "}
        <a href="/disclaimer">Risk Disclaimer</a> and <a href="/terms">Terms of Service</a>.
      </p>
    </LegalShell>
  );
}
