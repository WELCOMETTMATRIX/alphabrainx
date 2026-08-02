type Brand = {
  name: string;
  role: string;
  url: string;
  tag: "Market data" | "On-chain" | "AI" | "Platform" | "Community";
};

// Only services Alpha Brain actually integrates with or is distributed through.
export const TRUSTED_BRANDS: Brand[] = [
  { name: "Finnhub", role: "Live US stock quotes, candles & company data", url: "https://finnhub.io", tag: "Market data" },
  { name: "Crypto.com Exchange", role: "Public crypto market tickers & candlesticks", url: "https://crypto.com/exchange", tag: "Market data" },
  { name: "DexScreener", role: "DEX pairs, liquidity & trending on-chain tokens", url: "https://dexscreener.com", tag: "On-chain" },
  { name: "GeckoTerminal", role: "Multi-chain pools, OHLCV & new token discovery", url: "https://www.geckoterminal.com", tag: "On-chain" },
  { name: "Lovable AI Gateway", role: "Reasoning engine behind the AI Brain & scans", url: "https://docs.lovable.dev/features/ai", tag: "AI" },
  { name: "TradingView Lightweight Charts", role: "Charting engine used across every asset view", url: "https://www.tradingview.com/lightweight-charts/", tag: "Platform" },
  { name: "Electron", role: "Windows desktop build of Alpha Brain", url: "https://www.electronjs.org", tag: "Platform" },
  { name: "ScamWatch × Nova", role: "Powers the AI Intelligence Center threat data", url: "https://scamwatchnova.lovable.app", tag: "Community" },
  { name: "Product Hunt", role: "Where Alpha Brain launched and collects feedback", url: "https://www.producthunt.com/products/alpha-brain", tag: "Community" },
];

export function TrustedBrands({ compact = false }: { compact?: boolean }) {
  return (
    <div className="not-prose">
      <div className="grid gap-3 sm:grid-cols-2">
        {TRUSTED_BRANDS.map((b) => (
          <a
            key={b.name}
            href={b.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-cyan-400/40 hover:bg-white/[0.06]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-white group-hover:text-cyan-300">{b.name}</span>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-slate-400">
                {b.tag}
              </span>
            </div>
            {!compact && <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{b.role}</p>}
          </a>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
        Logos and names belong to their owners. Listing a provider means Alpha Brain consumes its public
        API or distributes through it — it does not imply endorsement, partnership or certification.
      </p>
    </div>
  );
}
