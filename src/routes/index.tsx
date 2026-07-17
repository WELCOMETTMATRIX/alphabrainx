import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi } from "lightweight-charts";
import {
  aiAnalyze,
  getCryptoCandles,
  getCryptoQuote,
  getStockCandles,
  getStockQuote,
  getTopCryptoMovers,
  searchStocks,
} from "@/lib/market.functions";

export const Route = createFileRoute("/")({ component: Dashboard });

type Kind = "stock" | "crypto";
type Watch = { symbol: string; kind: Kind; label?: string };

const DEFAULT_WATCH: Watch[] = [
  { symbol: "AAPL", kind: "stock", label: "Apple" },
  { symbol: "NVDA", kind: "stock", label: "NVIDIA" },
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

  // live quotes
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

  const moversQuery = useQuery({
    queryKey: ["movers"],
    queryFn: () => getTopCryptoMovers(),
    refetchInterval: 60000,
  });

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

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-[1400px] px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <aside className="lg:col-span-3 space-y-4">
          <Watchlist watch={watch} setWatch={setWatch} selected={selected} setSelected={setSelected} quotes={assetsSummary} />
          <MoversCard movers={moversQuery.data} onPick={(sym) => { setWatch((w) => w.find((x) => x.symbol === sym) ? w : [...w, { symbol: sym, kind: "crypto" }]); setSelected({ symbol: sym, kind: "crypto" }); }} />
        </aside>

        <main className="lg:col-span-6 space-y-4">
          <SymbolHeader selected={selected} quote={assetsSummary.find((a) => a.symbol === selected.symbol)} />
          <ChartCard data={candlesQuery.data ?? []} loading={candlesQuery.isLoading} />
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
          />
        </aside>
      </div>
      <footer className="text-center text-xs text-muted-foreground pb-6">
        Data: Finnhub (stocks) · Binance (crypto). AI analysis — not financial advice.
      </footer>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border/60 backdrop-blur bg-background/60 sticky top-0 z-10">
      <div className="mx-auto max-w-[1400px] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/40 grid place-items-center">
            <span className="text-primary font-black">α</span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Alpha Brain</h1>
            <p className="text-xs text-muted-foreground -mt-0.5">AI-powered stocks & crypto tracker</p>
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
    <div className="relative w-72">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => setOpen(true)}
        placeholder="Search stocks (e.g. AAPL, Tesla)…"
        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/60"
      />
      {open && q.length >= 2 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-xl max-h-72 overflow-auto">
          {search.data?.length ? search.data.map((r) => (
            <div key={r.symbol} className="px-3 py-2 text-sm hover:bg-secondary cursor-pointer flex justify-between"
              onMouseDown={() => { window.dispatchEvent(new CustomEvent("add-symbol", { detail: { symbol: r.symbol, kind: "stock", label: r.description } })); setQ(""); setOpen(false); }}>
              <span className="font-medium">{r.symbol}</span>
              <span className="text-muted-foreground truncate ml-2">{r.description}</span>
            </div>
          )) : <div className="px-3 py-2 text-xs text-muted-foreground">No results</div>}
        </div>
      )}
    </div>
  );
}

function Watchlist({ watch, setWatch, selected, setSelected, quotes }: {
  watch: Watch[]; setWatch: (w: Watch[]) => void; selected: Watch; setSelected: (w: Watch) => void;
  quotes: Array<{ symbol: string; price: number; changePercent: number }>;
}) {
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as Watch;
      setWatch(watch.find((w) => w.symbol === d.symbol) ? watch : [...watch, d]);
    };
    window.addEventListener("add-symbol", h);
    return () => window.removeEventListener("add-symbol", h);
  }, [watch, setWatch]);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-sm font-semibold">Watchlist</h2>
        <span className="text-xs text-muted-foreground">{watch.length} assets</span>
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
              className={`w-full flex items-center justify-between px-2 py-2 rounded-lg text-left transition ${isSel ? "bg-secondary" : "hover:bg-secondary/60"}`}
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold flex items-center gap-2">
                  {w.symbol}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${w.kind === "crypto" ? "bg-accent/20 text-accent-foreground" : "bg-primary/15 text-primary"}`}>
                    {w.kind}
                  </span>
                </span>
                {w.label && <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">{w.label}</span>}
              </div>
              <div className="text-right">
                <div className="text-sm font-mono">${fmt(q?.price)}</div>
                <div className={`text-xs font-mono ${up ? "text-[color:var(--bull)]" : "text-[color:var(--bear)]"}`}>
                  {q ? `${up ? "+" : ""}${q.changePercent.toFixed(2)}%` : "—"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <QuickAdd onAdd={(w) => setWatch(watch.find((x) => x.symbol === w.symbol) ? watch : [...watch, w])} />
      </div>
    </div>
  );
}

function QuickAdd({ onAdd }: { onAdd: (w: Watch) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-1 w-full">
      <input value={v} onChange={(e) => setV(e.target.value.toUpperCase())}
        placeholder="Add BTCUSDT / SPY…"
        className="flex-1 rounded-md bg-input border border-border px-2 py-1.5 text-xs outline-none" />
      <button
        onClick={() => { if (!v) return; const kind: Kind = v.endsWith("USDT") || v.endsWith("BTC") ? "crypto" : "stock"; onAdd({ symbol: v, kind }); setV(""); }}
        className="rounded-md bg-primary text-primary-foreground text-xs px-3 py-1.5 font-semibold hover:opacity-90">Add</button>
    </div>
  );
}

function MoversCard({ movers, onPick }: { movers: { gainers: Array<{ symbol: string; price: number; changePercent: number }>; losers: Array<{ symbol: string; price: number; changePercent: number }> } | undefined; onPick: (sym: string) => void }) {
  if (!movers) return <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">Loading movers…</div>;
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <h2 className="text-sm font-semibold mb-2 px-1">Crypto Top Movers (24h)</h2>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-[color:var(--bull)] font-semibold mb-1">Gainers</div>
          {movers.gainers.slice(0, 6).map((g) => (
            <button key={g.symbol} onClick={() => onPick(g.symbol)} className="w-full flex justify-between py-1 hover:bg-secondary/60 rounded px-1">
              <span className="font-mono">{g.symbol.replace("USDT", "")}</span>
              <span className="text-[color:var(--bull)]">+{g.changePercent.toFixed(1)}%</span>
            </button>
          ))}
        </div>
        <div>
          <div className="text-[color:var(--bear)] font-semibold mb-1">Losers</div>
          {movers.losers.slice(0, 6).map((g) => (
            <button key={g.symbol} onClick={() => onPick(g.symbol)} className="w-full flex justify-between py-1 hover:bg-secondary/60 rounded px-1">
              <span className="font-mono">{g.symbol.replace("USDT", "")}</span>
              <span className="text-[color:var(--bear)]">{g.changePercent.toFixed(1)}%</span>
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
    <div className="rounded-xl border border-border bg-card p-4 flex items-end justify-between">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{selected.kind}</div>
        <div className="text-2xl font-bold">{selected.symbol}</div>
        {selected.label && <div className="text-sm text-muted-foreground">{selected.label}</div>}
      </div>
      <div className="text-right">
        <div className="text-3xl font-mono font-bold">${fmt(quote?.price)}</div>
        <div className={`text-sm font-mono ${up ? "text-[color:var(--bull)]" : "text-[color:var(--bear)]"}`}>
          {quote ? `${up ? "▲" : "▼"} ${quote.changePercent.toFixed(2)}%` : "—"}
        </div>
        <div className="text-xs text-muted-foreground font-mono mt-1">H ${fmt(quote?.high)} · L ${fmt(quote?.low)}</div>
      </div>
    </div>
  );
}

function ChartCard({ data, loading }: { data: Array<{ time: number; open: number; high: number; low: number; close: number }>; loading: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: "#c9d1e2" },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
    });
    const s = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e", downColor: "#ef4444", borderVisible: false, wickUpColor: "#22c55e", wickDownColor: "#ef4444",
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
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-sm font-semibold">Price Chart</h2>
        {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>
      <div ref={containerRef} className="h-[480px] w-full" />
    </div>
  );
}

function AIPanel({ text, loading, error, onRun, question, setQuestion, onAsk }: {
  text: string; loading: boolean; error: Error | null; onRun: () => void; question: string; setQuestion: (s: string) => void; onAsk: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex flex-col min-h-[560px]">
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          AI Brain
        </h2>
        <button onClick={onRun} disabled={loading}
          className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50">
          {loading ? "Thinking…" : "Analyze market"}
        </button>
      </div>
      <div className="flex-1 overflow-auto text-sm rounded-lg bg-background/40 border border-border p-3 whitespace-pre-wrap leading-relaxed">
        {error ? <span className="text-[color:var(--bear)]">Error: {error.message}</span>
          : text || <span className="text-muted-foreground text-xs">Click "Analyze market" for AI comparison, uptrend paths, and top ideas across your watchlist and selected symbol. You can also ask a question below.</span>}
      </div>
      <div className="mt-2 flex gap-1">
        <input value={question} onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onAsk(); }}
          placeholder="Ask about the selected symbol…"
          className="flex-1 rounded-md bg-input border border-border px-2 py-1.5 text-xs outline-none" />
        <button onClick={onAsk} disabled={loading || !question}
          className="rounded-md bg-secondary text-secondary-foreground text-xs px-3 py-1.5 font-semibold hover:bg-secondary/80 disabled:opacity-50">Ask</button>
      </div>
    </div>
  );
}
