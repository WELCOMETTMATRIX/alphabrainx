import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { Activity, Brain, Flame, Loader2, Plus, Search, Sparkles, TrendingDown, TrendingUp, Zap } from "lucide-react";
import {
  aiAnalyze,
  aiMarketScan,
  getCryptoCandles,
  getCryptoQuote,
  getMarketPulse,
  getStockCandles,
  getStockQuote,
  getTopCryptoMovers,
  getTrendingStocks,
  searchStocks,
} from "@/lib/market.functions";

export const Route = createFileRoute("/")({ component: Dashboard });

type Kind = "stock" | "crypto";
type Watch = { symbol: string; kind: Kind; label?: string };

const DEFAULT_WATCH: Watch[] = [
  { symbol: "NVDA", kind: "stock", label: "NVIDIA" },
  { symbol: "AAPL", kind: "stock", label: "Apple" },
  { symbol: "TSLA", kind: "stock", label: "Tesla" },
  { symbol: "MSFT", kind: "stock", label: "Microsoft" },
  { symbol: "BTCUSDT", kind: "crypto", label: "Bitcoin" },
  { symbol: "ETHUSDT", kind: "crypto", label: "Ethereum" },
  { symbol: "SOLUSDT", kind: "crypto", label: "Solana" },
];

function fmt(n: number | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

function Dashboard() {
  const [watch, setWatch] = useState<Watch[]>(DEFAULT_WATCH);
  const [selected, setSelected] = useState<Watch>(DEFAULT_WATCH[0]);
  const [aiText, setAiText] = useState<string>("");
  const [question, setQuestion] = useState("");

  const quotes = useQueries({
    queries: watch.map((w) => ({
      queryKey: ["quote", w.kind, w.symbol],
      queryFn: () =>
        w.kind === "stock"
          ? getStockQuote({ data: { symbol: w.symbol } })
          : getCryptoQuote({ data: { symbol: w.symbol } }),
      refetchInterval: 15000,
    })),
  });

  const assetsSummary = useMemo(
    () =>
      quotes
        .map((q, i) => (q.data ? { ...q.data, kind: watch[i].kind } : null))
        .filter(Boolean) as Array<{ symbol: string; kind: Kind; price: number; changePercent: number; high?: number; low?: number }>,
    [quotes, watch]
  );

  const candlesQuery = useQuery({
    queryKey: ["candles", selected.kind, selected.symbol],
    queryFn: () =>
      selected.kind === "stock"
        ? getStockCandles({ data: { symbol: selected.symbol, days: 60 } })
        : getCryptoCandles({ data: { symbol: selected.symbol, interval: "1h", limit: 200 } }),
    refetchInterval: 30000,
  });

  const cryptoMoversQuery = useQuery({ queryKey: ["cmovers"], queryFn: () => getTopCryptoMovers(), refetchInterval: 60000 });
  const stockMoversQuery = useQuery({ queryKey: ["smovers"], queryFn: () => getTrendingStocks(), refetchInterval: 60000 });
  const pulseQuery = useQuery({ queryKey: ["pulse"], queryFn: () => getMarketPulse(), refetchInterval: 30000 });

  const aiMut = useMutation({
    mutationFn: (q?: string) =>
      aiAnalyze({
        data: {
          assets: assetsSummary,
          symbol: selected.symbol,
          candles: candlesQuery.data ?? undefined,
          question: q,
        },
      }),
    onSuccess: (r) => setAiText(r.analysis),
  });

  const scanMut = useMutation({ mutationFn: () => aiMarketScan() });

  const addSymbol = (w: Watch) => setWatch((prev) => (prev.find((x) => x.symbol === w.symbol) ? prev : [...prev, w]));

  return (
    <div className="min-h-screen">
      <TickerTape stocks={stockMoversQuery.data} crypto={cryptoMoversQuery.data} />
      <Header />
      <PulseBar pulse={pulseQuery.data} />

      <div className="mx-auto max-w-[1500px] px-4 pb-10 pt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <aside className="lg:col-span-3 space-y-4">
          <Watchlist watch={watch} setWatch={setWatch} selected={selected} setSelected={setSelected} quotes={assetsSummary} />
          <MoversCard
            title="Crypto Movers"
            gainers={cryptoMoversQuery.data?.gainers ?? []}
            losers={cryptoMoversQuery.data?.losers ?? []}
            onPick={(sym) => { addSymbol({ symbol: sym, kind: "crypto" }); setSelected({ symbol: sym, kind: "crypto" }); }}
            stripUsdt
          />
          <MoversCard
            title="Stock Movers"
            gainers={stockMoversQuery.data?.gainers ?? []}
            losers={stockMoversQuery.data?.losers ?? []}
            onPick={(sym) => { addSymbol({ symbol: sym, kind: "stock" }); setSelected({ symbol: sym, kind: "stock" }); }}
          />
        </aside>

        <main className="lg:col-span-6 space-y-4">
          <SymbolHeader selected={selected} quote={assetsSummary.find((a) => a.symbol === selected.symbol)} />
          <ChartCard data={candlesQuery.data ?? []} loading={candlesQuery.isLoading} symbol={selected.symbol} />
          <ScanPanel
            data={scanMut.data}
            loading={scanMut.isPending}
            error={scanMut.error as Error | null}
            onRun={() => scanMut.mutate()}
            onPick={(sym, kind) => { addSymbol({ symbol: sym, kind }); setSelected({ symbol: sym, kind }); }}
          />
        </main>

        <aside className="lg:col-span-3 space-y-4">
          <AIPanel
            text={aiText}
            loading={aiMut.isPending}
            error={aiMut.error as Error | null}
            onRun={() => aiMut.mutate(undefined)}
            question={question}
            setQuestion={setQuestion}
            onAsk={() => aiMut.mutate(question)}
            symbol={selected.symbol}
          />
        </aside>
      </div>

      <footer className="text-center text-xs text-muted-foreground pb-8">
        <span className="font-mono">Alpha Brain v2 · </span>
        Finnhub · Binance · Lovable AI · Not financial advice
      </footer>
    </div>
  );
}

function TickerTape({ stocks, crypto }: {
  stocks?: { gainers: Array<{ symbol: string; price: number; changePercent: number }>; losers: Array<{ symbol: string; price: number; changePercent: number }> };
  crypto?: { gainers: Array<{ symbol: string; price: number; changePercent: number }>; losers: Array<{ symbol: string; price: number; changePercent: number }> };
}) {
  const items = useMemo(() => {
    const s = [...(stocks?.gainers ?? []), ...(stocks?.losers ?? [])];
    const c = [...(crypto?.gainers ?? []), ...(crypto?.losers ?? [])].slice(0, 12);
    return [...s, ...c.map((x) => ({ ...x, symbol: x.symbol.replace("USDT", "") }))];
  }, [stocks, crypto]);
  if (!items.length) return <div className="h-8 border-b border-border/40" />;
  const doubled = [...items, ...items];
  return (
    <div className="border-b border-border/40 bg-background/40 backdrop-blur overflow-hidden">
      <div className="flex whitespace-nowrap animate-ticker py-1.5 text-xs font-mono">
        {doubled.map((it, i) => {
          const up = it.changePercent >= 0;
          return (
            <span key={i} className="mx-4 inline-flex items-center gap-2">
              <span className="text-foreground/80">{it.symbol}</span>
              <span className="text-muted-foreground">${fmt(it.price)}</span>
              <span className={up ? "text-[color:var(--bull)]" : "text-[color:var(--bear)]"}>
                {up ? "▲" : "▼"} {Math.abs(it.changePercent).toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border/40 backdrop-blur-xl bg-background/50 sticky top-0 z-20">
      <div className="mx-auto max-w-[1500px] px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            <div className="h-10 w-10 rounded-xl grid place-items-center relative overflow-hidden" style={{ background: "var(--grad-neon)" }}>
              <Brain className="h-5 w-5 text-background relative z-10" strokeWidth={2.5} />
              <div className="absolute inset-0 animate-scan" style={{ background: "linear-gradient(180deg, transparent, oklch(1 0 0 / 0.4), transparent)", height: "50%" }} />
            </div>
            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-[color:var(--bull)] animate-pulse-ring" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              <span className="text-gradient">ALPHA BRAIN</span>
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground -mt-0.5 font-mono">
              Neural Market Intelligence · 2026
            </p>
          </div>
        </div>
        <SearchBox />
      </div>
    </header>
  );
}

function SearchBox() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const search = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchStocks({ data: { query: q } }),
    enabled: q.length >= 2,
  });
  return (
    <div className="relative w-full sm:w-80">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => setOpen(true)}
        placeholder="Scan any symbol… AAPL, Tesla"
        className="w-full rounded-xl bg-input/70 border border-border pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition"
      />
      {open && q.length >= 2 && (
        <div className="glass absolute z-30 mt-2 w-full rounded-xl overflow-hidden max-h-72 overflow-y-auto">
          {search.data?.length ? search.data.map((r: { symbol: string; description: string }) => (
            <button key={r.symbol}
              className="w-full px-3 py-2 text-sm hover:bg-primary/10 text-left flex justify-between items-center transition"
              onMouseDown={() => { window.dispatchEvent(new CustomEvent("add-symbol", { detail: { symbol: r.symbol, kind: "stock", label: r.description } })); setQ(""); setOpen(false); }}>
              <span className="font-mono font-semibold text-primary">{r.symbol}</span>
              <span className="text-muted-foreground truncate ml-2 text-xs">{r.description}</span>
            </button>
          )) : <div className="px-3 py-3 text-xs text-muted-foreground">No results</div>}
        </div>
      )}
    </div>
  );
}

function PulseBar({ pulse }: { pulse?: { stocks: Array<{ symbol: string; price: number; changePercent: number } | null>; crypto: Array<{ symbol: string; price: number; changePercent: number } | null> } }) {
  const items = [...(pulse?.stocks ?? []), ...(pulse?.crypto ?? [])].filter(Boolean) as Array<{ symbol: string; price: number; changePercent: number }>;
  return (
    <div className="mx-auto max-w-[1500px] px-4 pt-4">
      <div className="glass rounded-2xl p-3 flex items-center gap-2 overflow-x-auto">
        <div className="flex items-center gap-2 pr-3 border-r border-border/60 shrink-0">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Pulse</span>
        </div>
        {items.length === 0 && <span className="text-xs text-muted-foreground px-2">Loading market pulse…</span>}
        {items.map((it) => {
          const up = it.changePercent >= 0;
          return (
            <div key={it.symbol} className="flex items-center gap-2 px-3 py-1 rounded-lg bg-background/40 shrink-0">
              <span className="text-xs font-bold">{it.symbol.replace("USDT", "")}</span>
              <span className="text-xs font-mono text-muted-foreground">${fmt(it.price)}</span>
              <span className={`text-xs font-mono font-semibold ${up ? "text-[color:var(--bull)]" : "text-[color:var(--bear)]"}`}>
                {up ? "+" : ""}{it.changePercent.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Watchlist({ watch, setWatch, selected, setSelected, quotes }: {
  watch: Watch[]; setWatch: (fn: (w: Watch[]) => Watch[]) => void; selected: Watch; setSelected: (w: Watch) => void;
  quotes: Array<{ symbol: string; price: number; changePercent: number }>;
}) {
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as Watch;
      setWatch((prev) => (prev.find((w) => w.symbol === d.symbol) ? prev : [...prev, d]));
    };
    window.addEventListener("add-symbol", h);
    return () => window.removeEventListener("add-symbol", h);
  }, [setWatch]);

  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-primary" /> Watchlist
        </h2>
        <span className="text-[10px] text-muted-foreground font-mono">{watch.length}</span>
      </div>
      <div className="space-y-1">
        {watch.map((w) => {
          const q = quotes.find((x) => x.symbol === w.symbol);
          const up = (q?.changePercent ?? 0) >= 0;
          const isSel = selected.symbol === w.symbol;
          return (
            <button
              key={w.symbol}
              onClick={() => setSelected(w)}
              className={`group w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition relative overflow-hidden ${isSel ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/50 border border-transparent"}`}
            >
              {isSel && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary" />}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold flex items-center gap-2">
                  {w.symbol.replace("USDT", "")}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${w.kind === "crypto" ? "bg-accent/20 text-accent" : "bg-primary/15 text-primary"}`}>
                    {w.kind === "crypto" ? "crypto" : "stock"}
                  </span>
                </span>
                {w.label && <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{w.label}</span>}
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-mono font-semibold">${fmt(q?.price)}</div>
                <div className={`text-[11px] font-mono ${up ? "text-[color:var(--bull)]" : "text-[color:var(--bear)]"}`}>
                  {q ? `${up ? "+" : ""}${q.changePercent.toFixed(2)}%` : "—"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <QuickAdd onAdd={(w) => setWatch((prev) => (prev.find((x) => x.symbol === w.symbol) ? prev : [...prev, w]))} />
    </div>
  );
}

function QuickAdd({ onAdd }: { onAdd: (w: Watch) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="mt-3 flex gap-1.5">
      <input value={v} onChange={(e) => setV(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter" && v) {
            const kind: Kind = v.endsWith("USDT") || v.endsWith("BTC") ? "crypto" : "stock";
            onAdd({ symbol: v, kind }); setV("");
          }
        }}
        placeholder="BTCUSDT / SPY"
        className="flex-1 rounded-lg bg-input/60 border border-border px-2.5 py-1.5 text-xs font-mono outline-none focus:border-primary/60" />
      <button
        onClick={() => { if (!v) return; const kind: Kind = v.endsWith("USDT") || v.endsWith("BTC") ? "crypto" : "stock"; onAdd({ symbol: v, kind }); setV(""); }}
        className="rounded-lg text-xs px-3 py-1.5 font-bold hover:opacity-90 grid place-items-center" style={{ background: "var(--grad-neon)", color: "var(--primary-foreground)" }}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function MoversCard({ title, gainers, losers, onPick, stripUsdt }: {
  title: string;
  gainers: Array<{ symbol: string; changePercent: number }>;
  losers: Array<{ symbol: string; changePercent: number }>;
  onPick: (sym: string) => void;
  stripUsdt?: boolean;
}) {
  const clean = (s: string) => stripUsdt ? s.replace("USDT", "") : s;
  return (
    <div className="glass rounded-2xl p-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.15em] mb-2 px-1 flex items-center gap-2">
        <Flame className="h-3.5 w-3.5 text-accent" /> {title}
      </h2>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="space-y-0.5">
          <div className="text-[10px] font-mono uppercase text-[color:var(--bull)] mb-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Up
          </div>
          {gainers.slice(0, 5).map((g) => (
            <button key={g.symbol} onClick={() => onPick(g.symbol)} className="w-full flex justify-between py-1 px-1.5 rounded hover:bg-[color:var(--bull)]/10 transition">
              <span className="font-mono font-semibold truncate">{clean(g.symbol)}</span>
              <span className="text-[color:var(--bull)] font-mono">+{g.changePercent.toFixed(1)}%</span>
            </button>
          ))}
        </div>
        <div className="space-y-0.5">
          <div className="text-[10px] font-mono uppercase text-[color:var(--bear)] mb-1 flex items-center gap-1">
            <TrendingDown className="h-3 w-3" /> Down
          </div>
          {losers.slice(0, 5).map((g) => (
            <button key={g.symbol} onClick={() => onPick(g.symbol)} className="w-full flex justify-between py-1 px-1.5 rounded hover:bg-[color:var(--bear)]/10 transition">
              <span className="font-mono font-semibold truncate">{clean(g.symbol)}</span>
              <span className="text-[color:var(--bear)] font-mono">{g.changePercent.toFixed(1)}%</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SymbolHeader({ selected, quote }: { selected: Watch; quote?: { price: number; changePercent: number; high?: number; low?: number } }) {
  const up = (quote?.changePercent ?? 0) >= 0;
  return (
    <div className="glass rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-30 blur-3xl" style={{ background: up ? "var(--grad-bull)" : "var(--grad-bear)" }} />
      <div className="flex items-end justify-between gap-4 relative">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] px-2 py-0.5 rounded bg-secondary/60 text-muted-foreground">
              {selected.kind}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">LIVE</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--bull)] animate-pulse" />
          </div>
          <div className="text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            {selected.symbol.replace("USDT", "")}
          </div>
          {selected.label && <div className="text-sm text-muted-foreground">{selected.label}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl sm:text-4xl font-mono font-black tabular-nums">${fmt(quote?.price)}</div>
          <div className={`text-sm font-mono font-bold ${up ? "text-[color:var(--bull)]" : "text-[color:var(--bear)]"}`}>
            {quote ? `${up ? "▲" : "▼"} ${Math.abs(quote.changePercent).toFixed(2)}%` : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground font-mono mt-1">
            H ${fmt(quote?.high)} · L ${fmt(quote?.low)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ data, loading, symbol }: { data: Array<{ time: number; open: number; high: number; low: number; close: number }>; loading: boolean; symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: "#c9d1e2", fontFamily: "JetBrains Mono, monospace" },
      grid: { vertLines: { color: "rgba(120,140,180,0.05)" }, horzLines: { color: "rgba(120,140,180,0.05)" } },
      rightPriceScale: { borderColor: "rgba(120,140,180,0.1)" },
      timeScale: { borderColor: "rgba(120,140,180,0.1)", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
    });
    const s = chart.addSeries(CandlestickSeries, {
      upColor: "#4ade80", downColor: "#f87171", borderVisible: false, wickUpColor: "#4ade80", wickDownColor: "#f87171",
    });
    chartRef.current = chart;
    seriesRef.current = s;
    return () => { chart.remove(); chartRef.current = null; seriesRef.current = null; };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !data.length) return;
    seriesRef.current.setData(data.map((d) => ({ time: d.time as never, open: d.open, high: d.high, low: d.low, close: d.close })));
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary" /> {symbol.replace("USDT", "")} · Price
        </h2>
        {loading && <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> loading</span>}
      </div>
      <div ref={containerRef} className="h-[420px] w-full" />
    </div>
  );
}

type ScanData = {
  scan: {
    regime?: string;
    headline?: string;
    trending?: Array<{ symbol: string; kind: string; thesis: string; signal: string; confidence: number }>;
    avoid?: Array<{ symbol: string; kind: string; reason: string }>;
    ideas?: Array<{ title: string; action: string; entry: string; invalidation: string }>;
  } | null;
  raw: string;
};

function ScanPanel({ data, loading, error, onRun, onPick }: {
  data?: ScanData; loading: boolean; error: Error | null; onRun: () => void; onPick: (sym: string, kind: Kind) => void;
}) {
  const scan = data?.scan;
  return (
    <div className="glass rounded-2xl p-4 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: "var(--grad-neon)" }} />
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-accent" /> AI Market Scanner
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Scans stocks + crypto for trending signals</p>
        </div>
        <button onClick={onRun} disabled={loading}
          className="text-xs px-4 py-2 rounded-xl font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 neon-glow"
          style={{ background: "var(--grad-neon)", color: "var(--primary-foreground)" }}>
          {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning…</> : <><Zap className="h-3.5 w-3.5" /> Run Scan</>}
        </button>
      </div>

      {error && <div className="text-xs text-[color:var(--bear)]">Error: {error.message}</div>}
      {!scan && !loading && !error && (
        <div className="text-xs text-muted-foreground p-3 rounded-xl bg-background/40 border border-dashed border-border">
          Click <strong>Run Scan</strong> — the AI reads the whole tape (crypto + stock universe), classifies regime, then surfaces trending picks with confidence, avoid list, and actionable ideas.
        </div>
      )}

      {scan && (
        <div className="space-y-3">
          {scan.headline && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-background/40 border border-border">
              <span className={`shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${scan.regime === "risk-on" ? "bg-[color:var(--bull)]/20 text-[color:var(--bull)]" : scan.regime === "risk-off" ? "bg-[color:var(--bear)]/20 text-[color:var(--bear)]" : "bg-accent/20 text-accent"}`}>
                {scan.regime ?? "mixed"}
              </span>
              <p className="text-sm leading-snug">{scan.headline}</p>
            </div>
          )}

          {!!scan.trending?.length && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-[color:var(--bull)]" /> Trending Now
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {scan.trending.map((t, i) => (
                  <button key={i} onClick={() => onPick(t.symbol.replace(/USDT$/, "") + (t.kind === "crypto" ? "USDT" : ""), t.kind === "crypto" ? "crypto" : "stock")}
                    className="text-left p-2.5 rounded-xl bg-background/40 border border-border hover:border-primary/50 transition group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-sm text-primary">{t.symbol}</span>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-secondary/60">{t.signal}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{t.thesis}</p>
                    <div className="mt-1.5 flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, k) => (
                        <span key={k} className={`h-1 flex-1 rounded ${k < (t.confidence ?? 0) ? "bg-primary" : "bg-secondary/50"}`} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {!!scan.avoid?.length && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-[color:var(--bear)]" /> Avoid
                </div>
                <div className="space-y-1.5">
                  {scan.avoid.map((a, i) => (
                    <div key={i} className="p-2 rounded-lg bg-background/30 border border-border/60">
                      <div className="font-mono font-bold text-xs text-[color:var(--bear)]">{a.symbol}</div>
                      <div className="text-[11px] text-muted-foreground">{a.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!!scan.ideas?.length && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-accent" /> Ideas
                </div>
                <div className="space-y-1.5">
                  {scan.ideas.map((idea, i) => (
                    <div key={i} className="p-2 rounded-lg bg-background/30 border border-border/60">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${idea.action === "long" ? "bg-[color:var(--bull)]/20 text-[color:var(--bull)]" : idea.action === "short" ? "bg-[color:var(--bear)]/20 text-[color:var(--bear)]" : "bg-secondary/60"}`}>{idea.action}</span>
                        <span className="text-xs font-semibold truncate">{idea.title}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        <span className="text-foreground/70">Entry:</span> {idea.entry} · <span className="text-foreground/70">Stop:</span> {idea.invalidation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!scan && data?.raw && (
        <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap mt-2">{data.raw}</pre>
      )}
    </div>
  );
}

function AIPanel({ text, loading, error, onRun, question, setQuestion, onAsk, symbol }: {
  text: string; loading: boolean; error: Error | null; onRun: () => void; question: string; setQuestion: (s: string) => void; onAsk: () => void; symbol: string;
}) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-col min-h-[620px] relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: "var(--grad-neon)" }} />
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-primary" />
            AI Analyst
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">Focus: {symbol.replace("USDT", "")}</p>
        </div>
        <button onClick={onRun} disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
          style={{ background: "var(--grad-neon)", color: "var(--primary-foreground)" }}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? "Thinking" : "Analyze"}
        </button>
      </div>
      <div className="flex-1 overflow-auto text-sm rounded-xl bg-background/40 border border-border p-3 whitespace-pre-wrap leading-relaxed font-sans relative">
        {loading && (
          <div className="absolute inset-x-0 top-0 h-px animate-scan" style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)" }} />
        )}
        {error ? <span className="text-[color:var(--bear)]">Error: {error.message}</span>
          : text || <span className="text-muted-foreground text-xs">
            Compare watchlist assets · Detect uptrend paths · Get top ideas across markets.<br /><br />
            Click <strong>Analyze</strong> for a report on the selected symbol, or ask a question below.
          </span>}
      </div>
      <div className="mt-3 flex gap-1.5">
        <input value={question} onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onAsk(); }}
          placeholder={`Ask about ${symbol.replace("USDT", "")}…`}
          className="flex-1 rounded-lg bg-input/60 border border-border px-3 py-2 text-xs outline-none focus:border-primary/60" />
        <button onClick={onAsk} disabled={loading || !question}
          className="rounded-lg bg-secondary text-secondary-foreground text-xs px-3 py-2 font-bold hover:bg-secondary/80 disabled:opacity-50">
          Ask
        </button>
      </div>
    </div>
  );
}
