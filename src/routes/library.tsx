import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "./about";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Knowledge Library — Alpha Brain" },
      { name: "description", content: "Searchable reference library: how Alpha Brain computes RSI, MACD, ATR, correlation, backtests and on-chain risk — plus scam patterns and trading terminology." },
      { property: "og:title", content: "Knowledge Library — Alpha Brain" },
      { property: "og:description", content: "The exact formulas, thresholds and definitions behind every number in the terminal." },
    ],
  }),
  component: LibraryPage,
});

type Source = { label: string; href: string; note: string };

type Topic = {
  title: string;
  cat: "Indicators" | "Charts & data" | "AI & backtesting" | "On-chain" | "Security" | "Terminology";
  body: string;
  detail: string[];
  sources: Source[];
  confidence: { level: "High" | "Medium" | "Indicative"; note: string };
};

const SRC = {
  finnhub: {
    label: "Finnhub",
    href: "https://finnhub.io/docs/api",
    note: "Equity quotes and OHLC candles used for every stock number in this entry.",
  },
  cdcx: {
    label: "Crypto.com Exchange API",
    href: "https://exchange-docs.crypto.com/spot/index.html",
    note: "Spot tickers and candlesticks used for every crypto number in this entry.",
  },
  dexscreener: {
    label: "DexScreener",
    href: "https://docs.dexscreener.com/api/reference",
    note: "DEX pair prices, liquidity, volume and contract addresses across 30+ chains.",
  },
  gecko: {
    label: "GeckoTerminal",
    href: "https://www.geckoterminal.com/dex-api",
    note: "Pool-level OHLCV and cross-checking of DEX pricing.",
  },
  tv: {
    label: "TradingView Lightweight Charts",
    href: "https://tradingview.github.io/lightweight-charts/",
    note: "Rendering only — the library draws the candles, it does not supply data.",
  },
  ai: {
    label: "Lovable AI Gateway (Gemini)",
    href: "https://docs.lovable.dev/features/ai",
    note: "Language model that writes the read; it receives computed values, never raw invented figures.",
  },
  nova: {
    label: "ScamWatch × Nova",
    href: "https://scamwatchnova.lovable.app",
    note: "Threat intelligence records: wallets, domains, contracts and impersonation patterns.",
  },
} satisfies Record<string, Source>;

const TOPICS: Topic[] = [
  {
    title: "RSI (Relative Strength Index)",
    cat: "Indicators",
    body: "Momentum oscillator from 0–100 measuring the ratio of average gains to average losses.",
    detail: [
      "Alpha Brain uses a 14-period RSI computed from provider close prices on the selected timeframe.",
      "RSI = 100 − 100 / (1 + RS), where RS = average gain / average loss over the lookback.",
      "Above 70 is conventionally 'overbought', below 30 'oversold' — but strong trends can hold extremes for a long time, so the AI treats RSI as context, not a signal on its own.",
      "Divergence (price makes a new high, RSI does not) is flagged as a weakening-momentum note.",
    ],
    sources: [SRC.finnhub, SRC.cdcx, SRC.gecko],
    confidence: {
      level: "High",
      note: "Deterministic formula on provider closes. Accuracy is bounded by candle quality; the last, still-forming candle can shift the value until it closes.",
    },
  },
  {
    title: "MACD (Moving Average Convergence Divergence)",
    cat: "Indicators",
    body: "Trend-following momentum indicator built from two exponential moving averages.",
    detail: [
      "MACD line = EMA(12) − EMA(26); signal line = EMA(9) of the MACD line; histogram = MACD − signal.",
      "A histogram flipping positive is read as bullish momentum shift, negative as bearish.",
      "MACD lags by construction. In chop it produces frequent false crosses, which is exactly what the backtest sandbox is for.",
    ],
    sources: [SRC.finnhub, SRC.cdcx],
    confidence: {
      level: "High",
      note: "Exact computation, but EMA seeding needs enough history — with fewer than ~35 candles loaded the early values are approximate.",
    },
  },
  {
    title: "ATR (Average True Range)",
    cat: "Indicators",
    body: "Volatility measure used for position sizing and stop placement, not direction.",
    detail: [
      "True range = max(high − low, |high − prev close|, |low − prev close|); ATR is its 14-period average.",
      "The AI quotes ATR as a percentage of price so volatility is comparable between a $400 stock and a $0.0000012 token.",
      "A common use: place invalidation 1.5–2× ATR away so normal noise does not stop you out.",
    ],
    sources: [SRC.finnhub, SRC.cdcx, SRC.dexscreener],
    confidence: {
      level: "High",
      note: "Deterministic. On thin DEX pairs, wick outliers from low-liquidity prints can inflate ATR — read alongside pool liquidity.",
    },
  },
  {
    title: "SMA / EMA crossovers",
    cat: "Indicators",
    body: "Fast average crossing a slow average is the simplest trend-following framework.",
    detail: [
      "The backtest sandbox ships an SMA cross strategy with configurable fast and slow lengths (default 7 / 25).",
      "Crossovers are late by design: they trade certainty for confirmation.",
      "Test a cross on the exact asset and timeframe you plan to trade — parameters rarely transfer between markets.",
    ],
    sources: [SRC.finnhub, SRC.cdcx],
    confidence: {
      level: "High",
      note: "The averages are exact; their predictive value is not. Treat any crossover result as a hypothesis, not an edge.",
    },
  },
  {
    title: "Correlation & compare mode",
    cat: "Charts & data",
    body: "Compare mode overlays assets and computes Pearson correlation of their returns.",
    detail: [
      "Correlation runs on percentage returns, not raw prices, so assets at very different price levels are comparable.",
      "+1 means they moved identically, 0 means unrelated, −1 means opposite.",
      "High correlation across your watchlist means less diversification than it looks like — you may be holding one bet several times.",
    ],
    sources: [SRC.finnhub, SRC.cdcx, SRC.dexscreener],
    confidence: {
      level: "Medium",
      note: "Exact math, but mixing a 24/7 crypto series with a session-based equity series misaligns timestamps; treat cross-market correlation as directional, not precise.",
    },
  },
  {
    title: "Candles, timeframes and gaps",
    cat: "Charts & data",
    body: "Every chart is drawn with TradingView Lightweight Charts from provider candles.",
    detail: [
      "Providers bucket candles differently, so a 1h candle here can differ slightly from another terminal.",
      "Equities have session gaps (nights, weekends, holidays); crypto and on-chain pools trade continuously.",
      "Micro-cap tokens are rendered with up to 12 decimals so sub-0.0000 prices stay readable and precise.",
    ],
    sources: [SRC.tv, SRC.finnhub, SRC.cdcx, SRC.gecko],
    confidence: {
      level: "Medium",
      note: "Display is faithful to the provider payload, but candles are indicative and can be revised or delayed by the upstream feed. Not execution-grade.",
    },
  },
  {
    title: "How the AI Analyst reasons",
    cat: "AI & backtesting",
    body: "The model receives real numbers only — never invented ones.",
    detail: [
      "Inputs: live quote, recent candles, computed RSI/MACD/ATR/volume trend, plus your typed question.",
      "Output structure: regime read, technical read citing the indicator values, scenario weights and invalidation level.",
      "Probability figures are model estimates of scenario weighting, not statistical forecasts.",
      "Rate limits are enforced per IP with a daily global cap; when exhausted the panel says so rather than returning stale text.",
    ],
    sources: [SRC.ai, SRC.finnhub, SRC.cdcx, SRC.dexscreener],
    confidence: {
      level: "Indicative",
      note: "Inputs are factual; the narrative and any probability weighting are model opinion and can be wrong. Never treat an AI read as advice.",
    },
  },
  {
    title: "Reading a backtest honestly",
    cat: "AI & backtesting",
    body: "The sandbox replays a strategy over the loaded candle history and reports the result.",
    detail: [
      "Metrics reported include number of trades, win rate, cumulative return and drawdown behaviour.",
      "It does not model slippage, spread, funding or exchange fees — real results will be worse.",
      "A strategy tuned until it looks perfect on one history is overfitted. Prefer parameters that are merely 'okay' across several assets and timeframes.",
      "Small trade counts are noise, not evidence.",
    ],
    sources: [SRC.finnhub, SRC.cdcx],
    confidence: {
      level: "Indicative",
      note: "Arithmetic is exact over the loaded window only, with zero cost assumptions. Past behaviour on a limited history is weak evidence about the future.",
    },
  },
  {
    title: "Liquidity, FDV and market cap",
    cat: "On-chain",
    body: "The three numbers that decide whether an on-chain price is real.",
    detail: [
      "Pool liquidity is what you can actually trade against; a $3k pool cannot absorb a $3k order without severe slippage.",
      "FDV (fully diluted valuation) counts every token that will ever exist — it is often far above circulating market cap.",
      "A token with a huge FDV and tiny liquidity is a price that exists only on paper.",
    ],
    sources: [SRC.dexscreener, SRC.gecko],
    confidence: {
      level: "Medium",
      note: "Liquidity and volume come straight from indexed pool state; supply figures depend on token metadata that can be wrong or manipulated, so FDV is the weakest of the three.",
    },
  },
  {
    title: "Contract addresses and verification",
    cat: "On-chain",
    body: "The address is the identity of a token — the ticker is not.",
    detail: [
      "Names and symbols are freely reusable; anyone can deploy a token called the same thing.",
      "Alpha Brain surfaces the contract address for every on-chain asset so you can copy and verify it on a block explorer.",
      "Check holder distribution, liquidity lock and mint/freeze authority before interacting.",
    ],
    sources: [SRC.dexscreener, SRC.gecko, SRC.nova],
    confidence: {
      level: "High",
      note: "Addresses are copied verbatim from the indexer and are reliable identifiers. Always re-verify on a block explorer before sending funds.",
    },
  },
  {
    title: "Common scam patterns",
    cat: "Security",
    body: "Patterns tracked in the Intelligence Center, powered by ScamWatch × Nova.",
    detail: [
      "Impersonation: cloned brand names, near-identical domains and fake support accounts in replies.",
      "Honeypot: buying works, selling reverts — a contract-level trap.",
      "Rug pull: liquidity removed or unlocked shortly after a marketing push.",
      "Wash trading: fabricated volume to force a token onto trending lists.",
      "Approval drainers: a signature request that grants unlimited spend on your wallet.",
    ],
    sources: [SRC.nova, SRC.dexscreener],
    confidence: {
      level: "Medium",
      note: "Records are curated threat intelligence, not a legal finding. Inclusion is a strong risk signal; absence is never a safety guarantee.",
    },
  },
  {
    title: "Personal security checklist",
    cat: "Security",
    body: "Alpha Brain never asks for keys — nothing legitimate ever will.",
    detail: [
      "No seed phrase, private key or exchange API secret should ever be typed into this app or the AI box.",
      "Use a burn wallet for new tokens and revoke stale approvals regularly.",
      "Verify a threat record before acting: inclusion is a risk signal, absence is not a safety guarantee.",
    ],
    sources: [SRC.nova],
    confidence: {
      level: "High",
      note: "General security hygiene, independent of any data feed. It reduces risk but cannot eliminate it.",
    },
  },
  {
    title: "Slippage, spread and depth",
    cat: "Terminology",
    body: "The difference between the price you see and the price you get.",
    detail: [
      "Spread is the gap between best bid and best ask; depth is how much size sits near those levels.",
      "Slippage grows with order size relative to depth — the main hidden cost in thin crypto and on-chain markets.",
      "Displayed prices in any terminal, including this one, are indicative and not execution-grade.",
    ],
    sources: [SRC.cdcx, SRC.dexscreener],
    confidence: {
      level: "Indicative",
      note: "Alpha Brain shows last-trade prices, not full order-book depth, so realised slippage on your venue will differ.",
    },
  },
  {
    title: "Market regimes",
    cat: "Terminology",
    body: "The AI labels the market as trending, ranging or volatile before giving a read.",
    detail: [
      "Trend: higher highs and higher lows, momentum indicators aligned — breakouts tend to follow through.",
      "Range: price oscillating between boundaries — mean-reversion setups work, breakouts often fail.",
      "High volatility: wide ATR — reduce size rather than widen conviction.",
    ],
    sources: [SRC.ai, SRC.finnhub, SRC.cdcx],
    confidence: {
      level: "Indicative",
      note: "The label is a model classification over computed indicators. Regimes are only obvious in hindsight and flip without warning.",
    },
  },
  {
    title: "Alerts: how they fire",
    cat: "Terminology",
    body: "Alerts are evaluated locally against live quotes roughly every 3 seconds.",
    detail: [
      "Choose a direction (crosses above / below) or a ±2/5/10% quick chip from the current price.",
      "'Repeat on re-cross' re-arms the alert after it triggers instead of consuming it.",
      "Delivery uses your browser's notification system plus optional sound and vibration; nothing is pushed from our servers.",
    ],
    sources: [SRC.finnhub, SRC.cdcx, SRC.dexscreener],
    confidence: {
      level: "Medium",
      note: "Firing depends on the tab staying open and on provider refresh latency, so a fast wick between polls can be missed. Not a substitute for exchange-side orders.",
    },
  },
];


const CATS = ["All", "Indicators", "Charts & data", "AI & backtesting", "On-chain", "Security", "Terminology"] as const;

function LibraryPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return TOPICS.filter((t) => {
      if (cat !== "All" && t.cat !== cat) return false;
      if (!needle) return true;
      const hay =
        t.title +
        " " +
        t.body +
        " " +
        t.detail.join(" ") +
        " " +
        t.sources.map((s) => s.label + " " + s.note).join(" ") +
        " " +
        t.confidence.level +
        " " +
        t.confidence.note;
      return hay.toLowerCase().includes(needle);

    });
  }, [q, cat]);

  return (
    <LegalShell title="Knowledge Library">
      <p>
        The reference behind every number in the terminal: exact formulas, thresholds, definitions and the
        limits of each method. No marketing copy, no invented statistics.
      </p>

      <div className="not-prose my-5 space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the library — e.g. ATR, honeypot, FDV, backtest…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-400/40"
        />
        <div className="flex flex-wrap gap-1.5">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full border px-3 py-1 text-[11px] font-mono uppercase tracking-widest transition-colors ${
                cat === c
                  ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-300"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {list.map((t) => {
            const isOpen = open === t.title;
            return (
              <div key={t.title} className="rounded-xl border border-white/10 bg-white/[0.03]">
                <button
                  onClick={() => setOpen(isOpen ? null : t.title)}
                  className="flex w-full items-start justify-between gap-3 p-4 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">{t.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-400">{t.body}</span>
                  </span>
                  <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-slate-500">
                    {t.cat}
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-white/5">
                    <ul className="list-disc space-y-1.5 px-8 py-3 text-xs leading-relaxed text-slate-300">
                      {t.detail.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>

                    <div className="border-t border-white/5 px-4 py-3">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                        Sources &amp; citations
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {t.sources.map((s) => (
                          <li key={s.label} className="text-xs leading-relaxed text-slate-400">
                            <a
                              href={s.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-cyan-400 hover:text-cyan-300"
                            >
                              {s.label}
                            </a>{" "}
                            — {s.note}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="border-t border-white/5 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                          Confidence
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest ${
                            t.confidence.level === "High"
                              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                              : t.confidence.level === "Medium"
                                ? "border-amber-400/40 bg-amber-500/10 text-amber-300"
                                : "border-rose-400/40 bg-rose-500/10 text-rose-300"
                          }`}
                        >
                          {t.confidence.level}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{t.confidence.note}</p>
                    </div>
                  </div>
                )}

              </div>
            );
          })}
          {list.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-slate-400">
              No entry matches “{q}”. Try a broader term, or email a suggestion to xapp431@gmail.com.
            </p>
          )}
        </div>
      </div>

      <h2>Where the data comes from</h2>
      <p>
        Every formula above runs on live provider candles. Coverage, refresh rates and accuracy limits are
        documented on the <a href="/data-sources">Data Sources &amp; Disclosures</a> page.
      </p>
      <p>
        Nothing here is financial advice — see the <a href="/disclaimer">Risk Disclaimer</a>.
      </p>
    </LegalShell>
  );
}
