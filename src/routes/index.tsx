import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { createChart, CandlestickSeries, LineSeries, type IChartApi, type ISeriesApi } from "lightweight-charts";
import {
  Activity, Bell, BellRing, Brain, Copy, Download, ExternalLink, Flame, GitCompareArrows, LayoutGrid,
  Link2, Loader2, Minus, Plus, Search, Settings2, Shield, Sparkles, TrendingDown, TrendingUp,
  X, Zap,
} from "lucide-react";
import {
  aiAnalyze, aiMarketScan,
  getAllCryptoTokens, getAllStocks,
  getCryptoCandles, getCryptoQuote,
  getMarketPulse,
  getStockCandles, getStockQuote,
  getTopCryptoMovers, getTrendingStocks,
} from "@/lib/market.functions";
import {
  aiOnchainAnalyze, getOnchainCandles, getOnchainNew, getOnchainToken,
  getOnchainTrades, getOnchainTrending, searchOnchain,
} from "@/lib/onchain.functions";

export const Route = createFileRoute("/")({ component: Dashboard });

type Kind = "stock" | "crypto";
type Watch = { symbol: string; kind: Kind; label?: string };
type Alert = { id: string; symbol: string; kind: Kind; direction: "above" | "below"; target: number; note?: string; created: number; triggered?: number };
type MobileTab = "chart" | "browse" | "alerts" | "compare" | "ai";

const DEFAULT_WATCH: Watch[] = [
  { symbol: "NVDA", kind: "stock", label: "NVIDIA" },
  { symbol: "AAPL", kind: "stock", label: "Apple" },
  { symbol: "TSLA", kind: "stock", label: "Tesla" },
  { symbol: "MSFT", kind: "stock", label: "Microsoft" },
  { symbol: "BTCUSDT", kind: "crypto", label: "Bitcoin" },
  { symbol: "ETHUSDT", kind: "crypto", label: "Ethereum" },
  { symbol: "SOLUSDT", kind: "crypto", label: "Solana" },
];

const clean = (s: string) => s.replace(/USDT$|USD$/, "");
function fmt(n: number | undefined | null) {
  if (n == null || Number.isNaN(n)) return "—";
  const a = Math.abs(n);
  if (a === 0) return "0";
  if (a >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (a >= 1) return n.toFixed(2);
  if (a >= 0.01) return n.toFixed(4);
  // For micro-prices (e.g. 0.00001234) show enough decimals to keep 4 significant digits, capped at 12.
  const digits = Math.min(12, Math.max(4, 2 - Math.floor(Math.log10(a)) + 3));
  return n.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

// -------- Local storage helpers --------
function useLocal<T>(key: string, init: T): [T, (v: T | ((p: T) => T)) => void] {
  const [v, setV] = useState<T>(init);
  useEffect(() => {
    try { const raw = localStorage.getItem(key); if (raw) setV(JSON.parse(raw) as T); } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* noop */ } }, [key, v]);
  return [v, setV];
}

// ============================================================================
// DASHBOARD
// ============================================================================
function Dashboard() {
  const [watch, setWatch] = useLocal<Watch[]>("ab.watch", DEFAULT_WATCH);
  const [selected, setSelected] = useState<Watch>(DEFAULT_WATCH[0]);
  const [aiText, setAiText] = useState("");
  const [question, setQuestion] = useState("");
  const [mobileTab, setMobileTab] = useState<MobileTab>("chart");
  const [alerts, setAlerts] = useLocal<Alert[]>("ab.alerts", []);
  const [compareSyms, setCompareSyms] = useLocal<Watch[]>("ab.compare", []);
  const [compareOn, setCompareOn] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [openAsset, setOpenAsset] = useState<Watch | null>(null);
  const [scanScope, setScanScope] = useState<"cross" | "stocks" | "crypto" | "watchlist">("cross");
  const [panels, setPanels] = useLocal<{ chart: boolean; scan: boolean; ai: boolean }>("ab.panels", { chart: true, scan: true, ai: true });
  const [chartPop, setChartPop] = useState(false);
  const [aiPop, setAiPop] = useState(false);
  const [theme, setTheme] = useLocal<"solaris" | "nebula">("ab.theme", "solaris");
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);



  // Fetch quotes for watchlist + compare (dedupe)
  const tracked = useMemo(() => {
    const map = new Map<string, Watch>();
    [...watch, ...compareSyms].forEach((w) => map.set(w.symbol, w));
    return Array.from(map.values());
  }, [watch, compareSyms]);

  const quotes = useQueries({
    queries: tracked.map((w) => ({
      queryKey: ["quote", w.kind, w.symbol],
      queryFn: () => w.kind === "stock"
        ? getStockQuote({ data: { symbol: w.symbol } })
        : getCryptoQuote({ data: { symbol: w.symbol } }),
      refetchInterval: 15_000,
    })),
  });

  const quoteMap = useMemo(() => {
    const m = new Map<string, { price: number; changePercent: number; high?: number; low?: number }>();
    quotes.forEach((q, i) => { if (q.data) m.set(tracked[i].symbol, q.data); });
    return m;
  }, [quotes, tracked]);

  const assetsSummary = useMemo(
    () => watch.map((w) => {
      const q = quoteMap.get(w.symbol);
      return q ? { symbol: w.symbol, kind: w.kind, ...q } : null;
    }).filter(Boolean) as Array<{ symbol: string; kind: Kind; price: number; changePercent: number; high?: number; low?: number }>,
    [watch, quoteMap]
  );

  // Chart data — single symbol OR compare set
  const candlesQuery = useQuery({
    queryKey: ["candles", selected.kind, selected.symbol],
    queryFn: () => selected.kind === "stock"
      ? getStockCandles({ data: { symbol: selected.symbol, days: 60 } })
      : getCryptoCandles({ data: { symbol: selected.symbol, interval: "1h", limit: 200 } }),
    refetchInterval: 30_000,
    enabled: !compareOn,
  });

  const compareCandles = useQueries({
    queries: compareSyms.map((w) => ({
      queryKey: ["ccandles", w.kind, w.symbol],
      queryFn: () => w.kind === "stock"
        ? getStockCandles({ data: { symbol: w.symbol, days: 60 } })
        : getCryptoCandles({ data: { symbol: w.symbol, interval: "1h", limit: 200 } }),
      refetchInterval: 60_000,
      enabled: compareOn,
    })),
  });

  const cryptoMoversQuery = useQuery({ queryKey: ["cmovers"], queryFn: () => getTopCryptoMovers(), refetchInterval: 60_000 });
  const stockMoversQuery = useQuery({ queryKey: ["smovers"], queryFn: () => getTrendingStocks(), refetchInterval: 60_000 });
  const pulseQuery = useQuery({ queryKey: ["pulse"], queryFn: () => getMarketPulse(), refetchInterval: 30_000 });

  const aiMut = useMutation({
    mutationFn: (q?: string) => aiAnalyze({
      data: { assets: assetsSummary, symbol: selected.symbol, candles: candlesQuery.data ?? undefined, question: q },
    }),
    onSuccess: (r) => setAiText(r.analysis),
  });
  const scanMut = useMutation({ mutationFn: () => aiMarketScan({ data: { scope: scanScope, watchlist: scanScope === "watchlist" ? watch.map((w) => w.symbol) : undefined } }) });

  // -------- Alerts polling --------
  useEffect(() => {
    if (!alerts.length) return;
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      // Ask lazily on first alert
      Notification.requestPermission().catch(() => {});
    }
    const check = () => {
      let changed = false;
      const next = alerts.map((a) => {
        if (a.triggered) return a;
        const q = quoteMap.get(a.symbol);
        if (!q) return a;
        const hit = a.direction === "above" ? q.price >= a.target : q.price <= a.target;
        if (hit) {
          changed = true;
          const msg = `${clean(a.symbol)} ${a.direction} $${fmt(a.target)} — now $${fmt(q.price)}`;
          try { if ("Notification" in window && Notification.permission === "granted") new Notification("Alpha Brain alert", { body: msg }); } catch { /* noop */ }
          try { window.dispatchEvent(new CustomEvent("ab-toast", { detail: msg })); } catch { /* noop */ }
          return { ...a, triggered: Date.now() };
        }
        return a;
      });
      if (changed) setAlerts(next);
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, quoteMap]);

  const addSymbol = (w: Watch) => setWatch((prev) => prev.find((x) => x.symbol === w.symbol) ? prev : [...prev, w]);
  const focusOn = (w: Watch) => { addSymbol(w); setSelected(w); setMobileTab("chart"); };
  const toggleCompare = (w: Watch) => {
    setCompareSyms((prev) => {
      if (prev.find((x) => x.symbol === w.symbol)) return prev.filter((x) => x.symbol !== w.symbol);
      if (prev.length >= 4) return prev;
      return [...prev, w];
    });
  };

  const activeAlerts = alerts.filter((a) => !a.triggered).length;

  return (
    <div className="min-h-screen text-slate-100 flex flex-col relative">
      <ToastHost />
      <TickerTape stocks={stockMoversQuery.data} crypto={cryptoMoversQuery.data} />
      <Header alerts={activeAlerts} onOpenAlerts={() => setMobileTab("alerts")} onOpenInstall={() => setInstallOpen(true)} theme={theme} setTheme={setTheme} />
      <PulseBar pulse={pulseQuery.data} />

      {/* Desktop layout */}
      <div className="hidden lg:grid flex-1 grid-cols-12 gap-3 p-3 min-h-[calc(100vh-160px)]">
        <aside className="col-span-3 flex flex-col gap-3 min-h-0">
          <NavigatorPanel
            watch={watch} setWatch={setWatch} selected={selected} setSelected={setSelected}
            quoteMap={quoteMap}
            compareOn={compareOn} compareSyms={compareSyms} onToggleCompare={toggleCompare}
            onOpenAsset={(w) => setOpenAsset(w)}
          />
        </aside>
        <main className="col-span-6 flex flex-col gap-3 min-h-0">
          <SymbolHeader selected={selected} quote={quoteMap.get(selected.symbol)}
            compareOn={compareOn} setCompareOn={setCompareOn}
            compareCount={compareSyms.length}
            onExpand={() => setOpenAsset(selected)} />
          {panels.chart && !chartPop && (
            <PanelShell
              onClose={() => setPanels({ ...panels, chart: false })}
              onPop={() => setChartPop(true)}>
              {compareOn
                ? <CompareChart series={compareSyms} candles={compareCandles.map((c) => c.data ?? [])} loading={compareCandles.some((c) => c.isLoading)} />
                : <ChartCard data={candlesQuery.data ?? []} loading={candlesQuery.isLoading} symbol={selected.symbol} />}
            </PanelShell>
          )}
          {panels.scan && (
            <PanelShell onClose={() => setPanels({ ...panels, scan: false })}>
              <ScanPanel data={scanMut.data} loading={scanMut.isPending} error={scanMut.error as Error | null}
                scope={scanScope} setScope={setScanScope}
                onRun={() => scanMut.mutate()} onPick={(s, k) => setOpenAsset({ symbol: s, kind: k })} />
            </PanelShell>
          )}
          <PanelRestoreBar
            hidden={{ chart: !panels.chart, scan: !panels.scan, ai: !panels.ai }}
            onRestore={(k) => setPanels({ ...panels, [k]: true })}
          />
        </main>
        <aside className="col-span-3 flex flex-col gap-3 min-h-0">
          {panels.ai && !aiPop && (
            <PanelShell onClose={() => setPanels({ ...panels, ai: false })} onPop={() => setAiPop(true)}>
              <AIPanel text={aiText} loading={aiMut.isPending} error={aiMut.error as Error | null}
                onRun={() => aiMut.mutate(undefined)} question={question} setQuestion={setQuestion}
                onAsk={() => aiMut.mutate(question)} symbol={selected.symbol} />
            </PanelShell>
          )}
          <AlertsPanel alerts={alerts} setAlerts={setAlerts} selected={selected}
            currentPrice={quoteMap.get(selected.symbol)?.price} />
          <MoversMini crypto={cryptoMoversQuery.data} stocks={stockMoversQuery.data}
            onPickCrypto={(s) => setOpenAsset({ symbol: s, kind: "crypto" })}
            onPickStock={(s) => setOpenAsset({ symbol: s, kind: "stock" })} />
        </aside>
      </div>

      {/* Chart pop-out */}
      {chartPop && (
        <DraggableModal onClose={() => setChartPop(false)} title={`${clean(selected.symbol)} · Chart`} width={960}>
          <div className="p-4">
            {compareOn
              ? <CompareChart series={compareSyms} candles={compareCandles.map((c) => c.data ?? [])} loading={compareCandles.some((c) => c.isLoading)} />
              : <ChartCard data={candlesQuery.data ?? []} loading={candlesQuery.isLoading} symbol={selected.symbol} />}
          </div>
        </DraggableModal>
      )}
      {aiPop && (
        <DraggableModal onClose={() => setAiPop(false)} title={`AI Analyst · ${clean(selected.symbol)}`} width={620}>
          <div className="p-4">
            <AIPanel text={aiText} loading={aiMut.isPending} error={aiMut.error as Error | null}
              onRun={() => aiMut.mutate(undefined)} question={question} setQuestion={setQuestion}
              onAsk={() => aiMut.mutate(question)} symbol={selected.symbol} />
          </div>
        </DraggableModal>
      )}

      {/* Mobile layout */}
      <div className="lg:hidden flex-1 flex flex-col gap-3 p-3 pb-24 min-h-[calc(100vh-160px)]">
        {mobileTab === "chart" && (
          <>
            <SymbolHeader selected={selected} quote={quoteMap.get(selected.symbol)}
              compareOn={compareOn} setCompareOn={setCompareOn} compareCount={compareSyms.length}
              onExpand={() => setOpenAsset(selected)} />
            {compareOn
              ? <CompareChart series={compareSyms} candles={compareCandles.map((c) => c.data ?? [])} loading={compareCandles.some((c) => c.isLoading)} />
              : <ChartCard data={candlesQuery.data ?? []} loading={candlesQuery.isLoading} symbol={selected.symbol} />}
            <ScanPanel data={scanMut.data} loading={scanMut.isPending} error={scanMut.error as Error | null}
              scope={scanScope} setScope={setScanScope}
              onRun={() => scanMut.mutate()} onPick={(s, k) => setOpenAsset({ symbol: s, kind: k })} />
          </>
        )}
        {mobileTab === "browse" && (
          <NavigatorPanel watch={watch} setWatch={setWatch} selected={selected} setSelected={(w) => { setSelected(w); setMobileTab("chart"); }}
            quoteMap={quoteMap}
            compareOn={compareOn} compareSyms={compareSyms} onToggleCompare={toggleCompare}
            onOpenAsset={(w) => setOpenAsset(w)} />
        )}
        {mobileTab === "alerts" && (
          <AlertsPanel alerts={alerts} setAlerts={setAlerts} selected={selected}
            currentPrice={quoteMap.get(selected.symbol)?.price} />
        )}
        {mobileTab === "compare" && (
          <CompareManager compareSyms={compareSyms} onRemove={(s) => setCompareSyms((p) => p.filter((x) => x.symbol !== s))}
            onOpen={() => { setCompareOn(true); setMobileTab("chart"); }} />
        )}
        {mobileTab === "ai" && (
          <AIPanel text={aiText} loading={aiMut.isPending} error={aiMut.error as Error | null}
            onRun={() => aiMut.mutate(undefined)} question={question} setQuestion={setQuestion}
            onAsk={() => aiMut.mutate(question)} symbol={selected.symbol} />
        )}
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 px-3 pb-safe pointer-events-none">
        <div className="pointer-events-auto mt-2 mb-2 glass-strong rounded-2xl px-1.5 py-1.5 flex items-center justify-around">
          {([
            ["chart", <Activity key="c" className="h-5 w-5" />, "Chart"],
            ["browse", <LayoutGrid key="b" className="h-5 w-5" />, "Browse"],
            ["compare", <GitCompareArrows key="cm" className="h-5 w-5" />, "Compare"],
            ["alerts", <Bell key="a" className="h-5 w-5" />, "Alerts"],
            ["ai", <Brain key="ai" className="h-5 w-5" />, "AI"],
          ] as const).map(([id, icon, label]) => {
            const active = mobileTab === id;
            return (
              <button key={id} onClick={() => setMobileTab(id)}
                className={`tap flex-1 min-w-0 min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 ${active ? "text-white" : "text-slate-400"}`}
                style={active ? { background: "linear-gradient(180deg, oklch(1 0 0 / .14), oklch(1 0 0 / .04))", boxShadow: "0 0 0 1px oklch(.82 .14 210 / .3) inset, 0 4px 12px -4px oklch(.82 .14 210 / .5)" } : undefined}>
                <span className="relative">
                  {icon}
                  {id === "alerts" && activeAlerts > 0 && (
                    <span className="absolute -top-1 -right-2 text-[9px] font-bold bg-rose-500 text-white rounded-full px-1 min-w-[14px] text-center">{activeAlerts}</span>
                  )}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wider">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {installOpen && <InstallModal onClose={() => setInstallOpen(false)} />}
      {openAsset && (
        <AssetDetailModal
          asset={openAsset}
          onClose={() => setOpenAsset(null)}
          onPin={(w) => { setWatch((prev) => prev.find((x) => x.symbol === w.symbol) ? prev : [...prev, w]); setSelected(w); setOpenAsset(null); setMobileTab("chart"); }}
        />
      )}

      <footer className="hidden lg:block text-center text-[10px] text-slate-500 py-3 font-mono uppercase tracking-widest">
        Alpha Brain Pro · Crypto.com Exchange · Finnhub · Lovable AI · Not financial advice
      </footer>
    </div>
  );
}


// ============================================================================
// TOAST HOST — small glass toast for alert firings
// ============================================================================
function ToastHost() {
  const [msgs, setMsgs] = useState<{ id: number; text: string }[]>([]);
  useEffect(() => {
    const h = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      const id = Date.now() + Math.random();
      setMsgs((m) => [...m, { id, text }]);
      setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), 5000);
    };
    window.addEventListener("ab-toast", h);
    return () => window.removeEventListener("ab-toast", h);
  }, []);
  return (
    <div className="fixed top-3 right-3 z-50 space-y-2 max-w-[92vw]">
      {msgs.map((m) => (
        <div key={m.id} className="glass-strong rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl animate-in slide-in-from-top">
          <BellRing className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium">{m.text}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// HEADER
// ============================================================================
function Header({ alerts, onOpenAlerts, onOpenInstall, theme, setTheme }: { alerts: number; onOpenAlerts: () => void; onOpenInstall: () => void; theme: "solaris" | "nebula"; setTheme: (v: "solaris" | "nebula") => void }) {
  return (
    <header className="sticky top-0 z-20 px-3 pt-3 pt-safe">
      <div className="glass-strong rounded-2xl grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            <div className="h-10 w-10 rounded-2xl grid place-items-center relative overflow-hidden bg-gradient-to-br from-indigo-500 via-cyan-400 to-emerald-400 shadow-lg">
              <Brain className="h-5 w-5 text-black relative z-10" strokeWidth={2.5} />
              <div className="absolute inset-0 animate-scan" style={{ background: "linear-gradient(180deg, transparent, oklch(1 0 0 / 0.4), transparent)", height: "50%" }} />
            </div>
            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 animate-pulse-ring" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base sm:text-xl font-black tracking-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
              ALPHA <span className="bg-gradient-to-r from-indigo-300 via-cyan-200 to-emerald-300 bg-clip-text text-transparent">BRAIN</span>
            </h1>
            <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400 -mt-0.5 font-mono">Crystal Terminal · 2026</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:block"><SearchBox /></div>
          <button onClick={onOpenInstall} title="Install app"
            className="tap h-10 px-3 sm:px-3 grid place-items-center rounded-xl glass hover:bg-white/10 flex items-center gap-1.5">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-semibold uppercase tracking-wider">Install</span>
          </button>
          <button onClick={onOpenAlerts} title="Alerts" className="tap relative h-10 w-10 grid place-items-center rounded-xl glass hover:bg-white/10">
            <Bell className="h-4 w-4" />
            {alerts > 0 && <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-rose-500 text-white rounded-full px-1 min-w-[14px] text-center">{alerts}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}

function SearchBox() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const search = useQuery({
    queryKey: ["search", q],
    queryFn: async () => {
      const { searchStocks } = await import("@/lib/market.functions");
      return searchStocks({ data: { query: q } });
    },
    enabled: q.length >= 2,
  });
  return (
    <div className="relative w-64">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)} onFocus={() => setOpen(true)}
        placeholder="Scan symbol… AAPL / BTC"
        className="w-full rounded-xl glass pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-slate-500" />
      {open && q.length >= 2 && (
        <div className="glass-strong absolute z-30 mt-2 w-full rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
          {search.data?.length ? search.data.map((r: { symbol: string; description: string }) => (
            <button key={r.symbol}
              className="w-full px-3 py-2 text-sm hover:bg-white/10 text-left flex justify-between items-center transition"
              onMouseDown={() => { window.dispatchEvent(new CustomEvent("add-symbol", { detail: { symbol: r.symbol, kind: "stock", label: r.description } })); setQ(""); setOpen(false); }}>
              <span className="font-mono font-semibold text-primary">{r.symbol}</span>
              <span className="text-slate-400 truncate ml-2 text-xs">{r.description}</span>
            </button>
          )) : <div className="px-3 py-3 text-xs text-slate-500">No results</div>}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TICKER & PULSE
// ============================================================================
function TickerTape({ stocks, crypto }: {
  stocks?: { gainers: Array<{ symbol: string; price: number; changePercent: number }>; losers: Array<{ symbol: string; price: number; changePercent: number }> };
  crypto?: { gainers: Array<{ symbol: string; price: number; changePercent: number }>; losers: Array<{ symbol: string; price: number; changePercent: number }> };
}) {
  const items = useMemo(() => {
    const s = [...(stocks?.gainers ?? []), ...(stocks?.losers ?? [])];
    const c = [...(crypto?.gainers ?? []), ...(crypto?.losers ?? [])].slice(0, 12);
    return [...s, ...c].filter((it) => it && typeof it.changePercent === "number" && !Number.isNaN(it.changePercent) && typeof it.price === "number");
  }, [stocks, crypto]);
  if (!items.length) return <div className="h-8" />;
  const doubled = [...items, ...items];
  return (
    <div className="border-b border-white/5 bg-black/20 backdrop-blur-md overflow-hidden">
      <div className="flex whitespace-nowrap animate-ticker py-1.5 text-[11px] font-mono">
        {doubled.map((it, i) => {
          const up = it.changePercent >= 0;
          return (
            <span key={i} className="mx-4 inline-flex items-center gap-2">
              <span className="text-slate-500">{clean(it.symbol)}</span>
              <span className="text-slate-200">${fmt(it.price)}</span>
              <span className={up ? "text-emerald-400" : "text-rose-400"}>{up ? "▲" : "▼"} {Math.abs(it.changePercent).toFixed(2)}%</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function PulseBar({ pulse }: { pulse?: { stocks: Array<{ symbol: string; price: number; changePercent: number } | null>; crypto: Array<{ symbol: string; price: number; changePercent: number } | null> } }) {
  const items = ([...(pulse?.stocks ?? []), ...(pulse?.crypto ?? [])].filter(
    (it): it is { symbol: string; price: number; changePercent: number } =>
      !!it && typeof it.changePercent === "number" && !Number.isNaN(it.changePercent)
  ));
  return (
    <div className="px-3 pt-3">
      <div className="glass rounded-2xl p-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 pr-3 border-r border-white/10 shrink-0">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Pulse</span>
        </div>
        {items.length === 0 && <span className="text-xs text-slate-500 px-2">Loading market pulse…</span>}
        {items.map((it) => {
          const up = it.changePercent >= 0;
          return (
            <div key={it.symbol} className="glass-pill flex items-center gap-2 px-3 py-1 shrink-0">
              <span className="text-xs font-bold">{clean(it.symbol)}</span>
              <span className="text-xs font-mono text-slate-400">${fmt(it.price)}</span>
              <span className={`text-xs font-mono font-semibold ${up ? "text-emerald-400" : "text-rose-400"}`}>
                {up ? "+" : ""}{it.changePercent.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// SYMBOL HEADER + CHART
// ============================================================================
function SymbolHeader({ selected, quote, compareOn, setCompareOn, compareCount, onExpand }: {
  selected: Watch; quote?: { price: number; changePercent: number; high?: number; low?: number };
  compareOn: boolean; setCompareOn: (b: boolean) => void; compareCount: number;
  onExpand?: () => void;
}) {
  const up = (quote?.changePercent ?? 0) >= 0;
  return (
    <div className="glass rounded-2xl p-4 sm:p-5 relative overflow-hidden">
      <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-40 blur-3xl" style={{ background: up ? "var(--grad-bull)" : "var(--grad-bear)" }} />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 relative">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] px-2 py-0.5 rounded-full glass-pill">{selected.kind}</span>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
            </span>
            <button
              onClick={() => setCompareOn(!compareOn)}
              className={`ml-auto sm:ml-0 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 transition ${compareOn ? "bg-primary/25 text-primary border border-primary/40" : "glass-pill hover:bg-white/10"}`}>
              <GitCompareArrows className="h-3 w-3" /> Compare {compareCount ? `· ${compareCount}` : ""}
            </button>
            {onExpand && (
              <button onClick={onExpand}
                className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 glass-pill hover:bg-white/10 transition"
                title="Open detail">
                <ExternalLink className="h-3 w-3" /> Detail
              </button>
            )}
          </div>
          <div className="text-2xl sm:text-4xl font-black tracking-tight truncate" style={{ fontFamily: "var(--font-display)" }}>
            {clean(selected.symbol)}
          </div>
          {selected.label && <div className="text-xs sm:text-sm text-slate-400 truncate">{selected.label}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl sm:text-4xl font-mono font-black tabular-nums">${fmt(quote?.price)}</div>
          <div className={`text-sm font-mono font-bold ${up ? "text-emerald-400" : "text-rose-400"}`}>
            {quote ? `${up ? "▲" : "▼"} ${Math.abs(quote.changePercent).toFixed(2)}%` : "—"}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">H ${fmt(quote?.high)} · L ${fmt(quote?.low)}</div>
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
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
    });
    const s = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981", downColor: "#f43f5e", borderUpColor: "#10b981", borderDownColor: "#f43f5e",
      wickUpColor: "#10b981", wickDownColor: "#f43f5e",
    });
    chartRef.current = chart; seriesRef.current = s;
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
          <Activity className="h-3.5 w-3.5 text-primary" /> {clean(symbol)} · Price
        </h2>
        {loading && <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> loading</span>}
      </div>
      <div ref={containerRef} className="h-[320px] sm:h-[420px] w-full" />
    </div>
  );
}

// ============================================================================
// COMPARE CHART — normalized % overlay + correlation matrix
// ============================================================================
const LINE_COLORS = ["#22d3ee", "#a78bfa", "#fbbf24", "#f472b6"];

type Candle = { time: number; close: number };

function CompareChart({ series, candles, loading }: {
  series: Watch[];
  candles: Array<Array<Candle & { open: number; high: number; low: number }>>;
  loading: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const linesRef = useRef<Array<ISeriesApi<"Line">>>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: "#c9d1e2", fontFamily: "JetBrains Mono, monospace" },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
    });
    chartRef.current = chart;
    return () => { chart.remove(); chartRef.current = null; linesRef.current = []; };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    // remove old
    linesRef.current.forEach((l) => chart.removeSeries(l));
    linesRef.current = [];
    series.forEach((_, i) => {
      const c = candles[i];
      if (!c?.length) return;
      const base = c[0].close;
      const line = chart.addSeries(LineSeries, { color: LINE_COLORS[i % LINE_COLORS.length], lineWidth: 2 });
      line.setData(c.map((d) => ({ time: d.time as never, value: ((d.close - base) / base) * 100 })));
      linesRef.current.push(line);
    });
    chart.timeScale().fitContent();
  }, [series, candles]);

  // Correlation matrix — Pearson on normalized returns
  const corr = useMemo(() => {
    const n = series.length;
    const out: number[][] = Array.from({ length: n }, () => Array(n).fill(1));
    const rets = candles.map((c) => c.slice(1).map((d, i) => (d.close - c[i].close) / c[i].close));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = rets[i]; const b = rets[j];
      if (!a?.length || !b?.length) { out[i][j] = out[j][i] = 0; continue; }
      const L = Math.min(a.length, b.length);
      const A = a.slice(-L); const B = b.slice(-L);
      const ma = A.reduce((s, x) => s + x, 0) / L;
      const mb = B.reduce((s, x) => s + x, 0) / L;
      let num = 0, da = 0, db = 0;
      for (let k = 0; k < L; k++) { const x = A[k] - ma; const y = B[k] - mb; num += x * y; da += x * x; db += y * y; }
      const r = num / (Math.sqrt(da * db) || 1);
      out[i][j] = out[j][i] = isFinite(r) ? r : 0;
    }
    return out;
  }, [candles, series.length]);

  return (
    <div className="glass rounded-2xl p-3 space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] flex items-center gap-2">
          <GitCompareArrows className="h-3.5 w-3.5 text-primary" /> Compare · Normalized %
        </h2>
        {loading && <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> loading</span>}
      </div>
      {series.length === 0 && (
        <div className="p-6 text-center text-sm text-slate-400">Add up to 4 assets from the Browse tab, then toggle Compare.</div>
      )}
      <div ref={containerRef} className="h-[280px] sm:h-[380px] w-full" />
      <div className="flex flex-wrap gap-2">
        {series.map((s, i) => (
          <div key={s.symbol} className="glass-pill flex items-center gap-2 px-3 py-1 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
            <span className="font-mono">{clean(s.symbol)}</span>
          </div>
        ))}
      </div>
      {series.length >= 2 && (
        <div className="pt-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 px-1">Correlation (30d)</div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `auto repeat(${series.length}, minmax(0,1fr))` }}>
            <div />
            {series.map((s) => <div key={"h" + s.symbol} className="text-[10px] font-mono text-slate-400 text-center truncate">{clean(s.symbol)}</div>)}
            {series.map((s, i) => (
              <>
                <div key={"r" + s.symbol} className="text-[10px] font-mono text-slate-400 truncate">{clean(s.symbol)}</div>
                {series.map((_, j) => {
                  const r = corr[i]?.[j] ?? 0;
                  const abs = Math.abs(r);
                  const bg = r > 0.7 ? "bg-emerald-500/40" : r < -0.7 ? "bg-rose-500/40" : abs > 0.3 ? "bg-white/10" : "bg-white/5";
                  return (
                    <div key={`c${i}-${j}`} className={`${bg} rounded text-[10px] font-mono text-center py-1`}>
                      {i === j ? "—" : r.toFixed(2)}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
          <div className="text-[10px] text-slate-500 mt-2 px-1">Green = moving together (r&gt;0.7) · Red = inverse (r&lt;-0.7)</div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SCAN PANEL
// ============================================================================
type ScanData = {
  scan: {
    regime?: string; headline?: string;
    trending?: Array<{ symbol: string; kind: string; thesis: string; signal: string; confidence: number }>;
    avoid?: Array<{ symbol: string; kind: string; reason: string }>;
    ideas?: Array<{ title: string; action: string; entry: string; invalidation: string }>;
  } | null;
  raw: string;
};

function ScanPanel({ data, loading, error, onRun, onPick, scope, setScope }: {
  data?: ScanData; loading: boolean; error: Error | null; onRun: () => void; onPick: (sym: string, kind: Kind) => void;
  scope?: "cross" | "stocks" | "crypto" | "watchlist"; setScope?: (s: "cross" | "stocks" | "crypto" | "watchlist") => void;
}) {
  const scan = data?.scan;
  return (
    <div className="glass rounded-2xl p-4 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: "var(--grad-neon)" }} />
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-accent" /> AI Market Scanner
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Scans every stock &amp; crypto for trending signals</p>
        </div>
        <button onClick={onRun} disabled={loading}
          className="text-xs px-4 py-2 rounded-xl font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          style={{ background: "var(--grad-neon)", color: "var(--primary-foreground)" }}>
          {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning…</> : <><Zap className="h-3.5 w-3.5" /> Run Scan</>}
        </button>
      </div>
      {setScope && (
        <div className="mb-3">
          <SegmentedTabs
            value={scope ?? "cross"}
            onChange={(v) => setScope(v as "cross" | "stocks" | "crypto" | "watchlist")}
            items={[
              { value: "cross", label: "All Markets" },
              { value: "stocks", label: "Stocks" },
              { value: "crypto", label: "Crypto" },
              { value: "watchlist", label: "Watchlist" },
            ]}
          />
        </div>
      )}
      {error && <div className="text-xs text-rose-400">Error: {error.message}</div>}
      {!scan && !loading && !error && (
        <div className="text-xs text-slate-400 p-3 rounded-xl glass">
          Click <strong>Run Scan</strong> — the AI reads the whole tape, classifies regime, surfaces trending picks with confidence, an avoid list, and actionable ideas.
        </div>
      )}
      {scan && (
        <div className="space-y-3">
          {scan.headline && (
            <div className="flex items-start gap-2 p-3 rounded-xl glass">
              <span className={`shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${scan.regime === "risk-on" ? "bg-emerald-500/20 text-emerald-400" : scan.regime === "risk-off" ? "bg-rose-500/20 text-rose-400" : "bg-accent/20 text-accent"}`}>{scan.regime ?? "mixed"}</span>
              <p className="text-sm leading-snug">{scan.headline}</p>
            </div>
          )}
          {!!scan.trending?.length && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-400 mb-1.5 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-400" /> Trending Now
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {scan.trending.map((t, i) => (
                  <button key={i} onClick={() => onPick(t.symbol.replace(/USDT$/, "") + (t.kind === "crypto" ? "USDT" : ""), t.kind === "crypto" ? "crypto" : "stock")}
                    className="text-left p-2.5 rounded-xl glass hover:bg-white/10 transition">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-sm text-primary">{t.symbol}</span>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded glass-pill">{t.signal}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">{t.thesis}</p>
                    <div className="mt-1.5 flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, k) => (
                        <span key={k} className={`h-1 flex-1 rounded ${k < (t.confidence ?? 0) ? "bg-primary" : "bg-white/10"}`} />
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
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-400 mb-1.5 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-rose-400" /> Avoid
                </div>
                <div className="space-y-1.5">{scan.avoid.map((a, i) => (
                  <div key={i} className="p-2 rounded-lg glass">
                    <div className="font-mono font-bold text-xs text-rose-400">{a.symbol}</div>
                    <div className="text-[11px] text-slate-400">{a.reason}</div>
                  </div>
                ))}</div>
              </div>
            )}
            {!!scan.ideas?.length && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-400 mb-1.5 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-accent" /> Ideas
                </div>
                <div className="space-y-1.5">{scan.ideas.map((idea, i) => (
                  <div key={i} className="p-2 rounded-lg glass">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${idea.action === "long" ? "bg-emerald-500/20 text-emerald-400" : idea.action === "short" ? "bg-rose-500/20 text-rose-400" : "glass-pill"}`}>{idea.action}</span>
                      <span className="text-xs font-semibold truncate">{idea.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      <span className="text-slate-300">Entry:</span> {idea.entry} · <span className="text-slate-300">Stop:</span> {idea.invalidation}
                    </div>
                  </div>
                ))}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AI PANEL
// ============================================================================
function AIPanel({ text, loading, error, onRun, question, setQuestion, onAsk, symbol }: {
  text: string; loading: boolean; error: Error | null; onRun: () => void;
  question: string; setQuestion: (s: string) => void; onAsk: () => void; symbol: string;
}) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-col min-h-[380px] lg:min-h-[420px] relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: "var(--grad-neon)" }} />
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-primary" /> AI Analyst
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">Focus: {clean(symbol)}</p>
        </div>
        <button onClick={onRun} disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          style={{ background: "var(--grad-neon)", color: "var(--primary-foreground)" }}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? "Thinking" : "Analyze"}
        </button>
      </div>
      <div className="flex-1 overflow-auto text-sm rounded-xl glass p-3 whitespace-pre-wrap leading-relaxed relative">
        {loading && (<div className="absolute inset-x-0 top-0 h-px animate-scan" style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)" }} />)}
        {error ? <span className="text-rose-400">Error: {error.message}</span>
          : text || <span className="text-slate-400 text-xs">
            Compare watchlist assets · Detect uptrend paths · Ask any market question.<br /><br />
            Tap <strong>Analyze</strong> for a report on {clean(symbol)}, or type below.
          </span>}
      </div>
      <div className="mt-3 flex gap-1.5">
        <input value={question} onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onAsk(); }}
          placeholder={`Ask about ${clean(symbol)}…`}
          className="flex-1 rounded-lg glass px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-slate-500" />
        <button onClick={onAsk} disabled={loading || !question}
          className="rounded-lg glass-strong text-xs px-4 py-2 font-bold hover:bg-white/15 disabled:opacity-50 min-h-[44px] min-w-[44px]">Ask</button>
      </div>
    </div>
  );
}

// ============================================================================
// NAVIGATOR — Watchlist / All Stocks / All Crypto (search + sort + compare toggle)
// ============================================================================
function NavigatorPanel({
  watch, setWatch, selected, setSelected, quoteMap,
  compareOn, compareSyms, onToggleCompare, onOpenAsset,
}: {
  watch: Watch[]; setWatch: (fn: (w: Watch[]) => Watch[]) => void;
  selected: Watch; setSelected: (w: Watch) => void;
  quoteMap: Map<string, { price: number; changePercent: number }>;
  compareOn: boolean; compareSyms: Watch[]; onToggleCompare: (w: Watch) => void;
  onOpenAsset?: (w: Watch) => void;
}) {
  const [tab, setTab] = useState<"watchlist" | "stocks" | "crypto" | "onchain">("watchlist");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"symbol" | "price" | "change" | "vol">("change");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as Watch;
      setWatch((prev) => prev.find((w) => w.symbol === d.symbol) ? prev : [...prev, d]);
    };
    window.addEventListener("add-symbol", h);
    return () => window.removeEventListener("add-symbol", h);
  }, [setWatch]);

  const stocksAll = useQuery({ queryKey: ["all-stocks"], queryFn: () => getAllStocks(), refetchInterval: 60_000, enabled: tab === "stocks" });
  const cryptoAll = useQuery({ queryKey: ["all-crypto"], queryFn: () => getAllCryptoTokens(), refetchInterval: 15_000, enabled: tab === "crypto" });

  const compareSet = useMemo(() => new Set(compareSyms.map((c) => c.symbol)), [compareSyms]);

  const items = useMemo(() => {
    let arr: Array<{ symbol: string; label: string; price: number; changePercent: number; volume?: number; kind: Kind }> = [];
    if (tab === "stocks") arr = (stocksAll.data ?? []).map((s) => ({ symbol: s.symbol, label: s.name, price: s.price, changePercent: s.changePercent, kind: "stock" }));
    else if (tab === "crypto") arr = (cryptoAll.data ?? []).map((t) => ({ symbol: t.symbol, label: `${t.base} · Crypto.com`, price: t.price, changePercent: t.changePercent, volume: t.volume, kind: "crypto" }));
    else if (tab === "watchlist") arr = watch.map((w) => { const qq = quoteMap.get(w.symbol); return { symbol: w.symbol, label: w.label ?? "", price: qq?.price ?? 0, changePercent: qq?.changePercent ?? 0, kind: w.kind }; });
    else arr = [];
    const qU = q.trim().toUpperCase();
    if (qU) arr = arr.filter((it) => it.symbol.includes(qU) || it.label.toUpperCase().includes(qU));
    const s = sort === "symbol" ? (a: typeof arr[0], b: typeof arr[0]) => a.symbol.localeCompare(b.symbol)
      : sort === "price" ? (a: typeof arr[0], b: typeof arr[0]) => a.price - b.price
      : sort === "vol" ? (a: typeof arr[0], b: typeof arr[0]) => (a.volume ?? 0) - (b.volume ?? 0)
      : (a: typeof arr[0], b: typeof arr[0]) => a.changePercent - b.changePercent;
    arr.sort(s); if (dir === "desc") arr.reverse();
    return arr.slice(0, 500);
  }, [tab, q, sort, dir, stocksAll.data, cryptoAll.data, watch, quoteMap]);

  const addAndSelect = (w: Watch) => {
    setWatch((prev) => prev.find((x) => x.symbol === w.symbol) ? prev : [...prev, w]);
    setSelected(w);
  };

  return (
    <div className="glass rounded-2xl flex flex-col min-h-0 flex-1 overflow-hidden">
      <div className="p-3 space-y-2.5 border-b border-white/5">
        <SegmentedTabs
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          items={[
            { value: "watchlist", label: `List · ${watch.length}` },
            { value: "stocks", label: "Stocks" },
            { value: "crypto", label: "CEX" },
            { value: "onchain", label: "Onchain" },
          ]}
        />
        {tab !== "onchain" && (
          <>
            <div className="relative">
              <input value={q} onChange={(e) => setQ(e.target.value)}
                placeholder={tab === "crypto" ? "Search Crypto.com tokens…" : tab === "stocks" ? "Filter stocks…" : "Type symbol + Enter (BTCUSDT / SPY)"}
                className="w-full glass rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-slate-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tab === "watchlist" && q) {
                    const raw = q.toUpperCase();
                    const kind: Kind = raw.includes("_") || raw.endsWith("USDT") || raw.endsWith("USD") ? "crypto" : "stock";
                    addAndSelect({ symbol: raw, kind }); setQ("");
                  }
                }} />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider">
              <span className="text-slate-500 mr-1">Sort</span>
              {(["symbol", "price", "change", "vol"] as const).map((s) => (
                <button key={s} onClick={() => { if (sort === s) setDir(dir === "asc" ? "desc" : "asc"); else { setSort(s); setDir("desc"); } }}
                  className={`px-2 py-1 rounded-full transition ${sort === s ? "bg-white/15 text-white" : "text-slate-400 hover:bg-white/5"}`}>
                  {s}{sort === s ? (dir === "asc" ? " ↑" : " ↓") : ""}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {tab === "onchain" ? (
        <OnchainExplorer />
      ) : (
        <VirtualList
          items={items} height={520}
          renderItem={(it) => {
            const up = it.changePercent >= 0;
            const isSel = it.symbol === selected.symbol;
            const inCompare = compareSet.has(it.symbol);
            return (
              <div className={`group flex items-center border-b border-white/5 ${isSel ? "bg-white/10" : ""}`}>
                <button onClick={() => {
                  const w: Watch = { symbol: it.symbol, kind: it.kind, label: it.label };
                  if (onOpenAsset) onOpenAsset(w); else addAndSelect(w);
                }}
                  className="flex-1 min-w-0 px-3 py-2.5 flex items-center justify-between hover:bg-white/5 transition text-left min-h-[52px]">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      {clean(it.symbol)}
                      <span className={`text-[8px] font-mono uppercase px-1 py-px rounded ${it.kind === "crypto" ? "bg-indigo-500/25 text-indigo-300" : "bg-cyan-500/25 text-cyan-300"}`}>{it.kind}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate max-w-[160px]">{it.label}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-mono text-slate-200">${fmt(it.price)}</div>
                    <div className={`text-[10px] font-mono ${up ? "text-emerald-400" : "text-rose-400"}`}>
                      {isFinite(it.changePercent) ? `${up ? "+" : ""}${it.changePercent.toFixed(2)}%` : "—"}
                    </div>
                  </div>
                </button>
                <button onClick={() => onToggleCompare({ symbol: it.symbol, kind: it.kind, label: it.label })}
                  title="Add to compare"
                  className={`shrink-0 h-11 w-10 grid place-items-center transition ${inCompare ? "text-primary" : "text-slate-500 hover:text-white opacity-0 group-hover:opacity-100"} ${compareOn ? "opacity-100" : ""}`}>
                  <GitCompareArrows className="h-4 w-4" />
                </button>
              </div>
            );
          }}
          loading={(tab === "stocks" && stocksAll.isLoading) || (tab === "crypto" && cryptoAll.isLoading)}
        />
      )}
    </div>
  );
}

// ============================================================================
// VIRTUAL LIST (lightweight, fixed row height)
// ============================================================================
function VirtualList<T>({ items, height, renderItem, loading, rowHeight = 52 }: {
  items: T[]; height: number; renderItem: (it: T, i: number) => React.ReactNode; loading?: boolean; rowHeight?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(height);
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el); setViewH(el.clientHeight);
    return () => ro.disconnect();
  }, []);
  const total = items.length * rowHeight;
  const overscan = 6;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(items.length, Math.ceil((scrollTop + viewH) / rowHeight) + overscan);
  const slice = items.slice(start, end);
  if (loading && !items.length) return <div className="p-4 text-[11px] text-slate-500 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading universe…</div>;
  if (!items.length) return <div className="p-4 text-[11px] text-slate-500">No matches.</div>;
  return (
    <div ref={scrollRef} onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      className="flex-1 min-h-0 overflow-y-auto" style={{ maxHeight: height }}>
      <div style={{ height: total, position: "relative" }}>
        <div style={{ position: "absolute", top: start * rowHeight, left: 0, right: 0 }}>
          {slice.map((it, i) => (
            <div key={start + i} style={{ height: rowHeight }}>{renderItem(it, start + i)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ALERTS PANEL
// ============================================================================
function AlertsPanel({ alerts, setAlerts, selected, currentPrice }: {
  alerts: Alert[]; setAlerts: (v: Alert[] | ((p: Alert[]) => Alert[])) => void;
  selected: Watch; currentPrice?: number;
}) {
  const [dir, setDir] = useState<"above" | "below">("above");
  const [target, setTarget] = useState<string>("");
  useEffect(() => { setTarget(currentPrice ? (currentPrice >= 1 ? currentPrice.toFixed(2) : currentPrice.toPrecision(4)) : ""); }, [selected.symbol, currentPrice]);

  const create = () => {
    const t = parseFloat(target); if (!t || Number.isNaN(t)) return;
    const a: Alert = { id: `${Date.now()}${Math.random()}`, symbol: selected.symbol, kind: selected.kind, direction: dir, target: t, created: Date.now() };
    setAlerts((prev) => [a, ...prev]);
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
  };
  const del = (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-primary" /> Price Alerts
        </h2>
        <span className="text-[10px] font-mono text-slate-500">{alerts.filter((a) => !a.triggered).length} active</span>
      </div>
      <div className="glass rounded-xl p-2.5 space-y-2 mb-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono font-bold text-primary">{clean(selected.symbol)}</span>
          <div className="glass-pill flex p-0.5 ml-auto">
            {(["above", "below"] as const).map((d) => (
              <button key={d} onClick={() => setDir(d)}
                className={`px-3 py-1 text-[10px] font-mono uppercase rounded-full transition ${dir === d ? "bg-white/20 text-white" : "text-slate-400"}`}>{d}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5">
          <input value={target} onChange={(e) => setTarget(e.target.value)} type="number" step="any"
            placeholder="Target price"
            className="flex-1 glass rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/40" />
          <button onClick={create}
            className="rounded-lg text-xs px-4 py-2 font-bold min-h-[44px] flex items-center gap-1"
            style={{ background: "var(--grad-neon)", color: "var(--primary-foreground)" }}>
            <Plus className="h-3.5 w-3.5" /> Set
          </button>
        </div>
        <p className="text-[10px] text-slate-500">Notifies you in-app + via browser notification when {clean(selected.symbol)} crosses your level. Checked every 30s while the tab is open.</p>
      </div>
      <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
        {alerts.length === 0 && <div className="text-[11px] text-slate-500 text-center py-4">No alerts yet.</div>}
        {alerts.map((a) => (
          <div key={a.id} className={`flex items-center gap-2 p-2 rounded-lg glass ${a.triggered ? "opacity-60" : ""}`}>
            <div className={`h-8 w-8 rounded-lg grid place-items-center ${a.direction === "above" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
              {a.direction === "above" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold">{clean(a.symbol)} <span className="text-slate-400 font-normal">{a.direction}</span> <span className="font-mono">${fmt(a.target)}</span></div>
              <div className="text-[10px] text-slate-500 font-mono">{a.triggered ? `triggered ${new Date(a.triggered).toLocaleTimeString()}` : "watching"}</div>
            </div>
            <button onClick={() => del(a.id)} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-white/10 text-slate-400"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// COMPARE MANAGER (mobile)
// ============================================================================
function CompareManager({ compareSyms, onRemove, onOpen }: {
  compareSyms: Watch[]; onRemove: (s: string) => void; onOpen: () => void;
}) {
  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] flex items-center gap-2">
          <GitCompareArrows className="h-3.5 w-3.5 text-primary" /> Compare Set
        </h2>
        <span className="text-[10px] font-mono text-slate-500">{compareSyms.length}/4</span>
      </div>
      {compareSyms.length === 0 ? (
        <div className="text-xs text-slate-400 py-4 text-center">
          Go to <strong>Browse</strong> and tap the <GitCompareArrows className="inline h-3.5 w-3.5" /> icon next to any asset to add it here (up to 4).
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            {compareSyms.map((c, i) => (
              <div key={c.symbol} className="flex items-center gap-2 p-2 rounded-lg glass">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold">{clean(c.symbol)}</div>
                  <div className="text-[10px] text-slate-500 truncate">{c.label ?? c.kind}</div>
                </div>
                <button onClick={() => onRemove(c.symbol)} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-white/10 text-slate-400"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={onOpen}
            className="w-full rounded-xl py-3 font-bold text-sm min-h-[44px]"
            style={{ background: "var(--grad-neon)", color: "var(--primary-foreground)" }}>
            Open Compare Chart
          </button>
        </>
      )}
    </div>
  );
}

// ============================================================================
// MOVERS MINI (right rail)
// ============================================================================
function MoversMini({ crypto, stocks, onPickCrypto, onPickStock }: {
  crypto?: { gainers: Array<{ symbol: string; price?: number; changePercent: number }>; losers: Array<{ symbol: string; price?: number; changePercent: number }> };
  stocks?: { gainers: Array<{ symbol: string; price?: number; changePercent: number }>; losers: Array<{ symbol: string; price?: number; changePercent: number }> };
  onPickCrypto: (s: string) => void; onPickStock: (s: string) => void;
}) {
  return (
    <div className="glass rounded-2xl p-3 grid grid-cols-2 gap-3 text-[11px]">
      <MoversCol title="Crypto ▲" items={crypto?.gainers ?? []} onPick={onPickCrypto} color="text-emerald-400" />
      <MoversCol title="Crypto ▼" items={crypto?.losers ?? []} onPick={onPickCrypto} color="text-rose-400" />
      <MoversCol title="Stocks ▲" items={stocks?.gainers ?? []} onPick={onPickStock} color="text-emerald-400" />
      <MoversCol title="Stocks ▼" items={stocks?.losers ?? []} onPick={onPickStock} color="text-rose-400" />
    </div>
  );
}
function MoversCol({ title, items, onPick, color }: {
  title: string; items: Array<{ symbol: string; changePercent: number }>; onPick: (s: string) => void; color: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{title}</div>
      <div className="space-y-0.5">
        {items.slice(0, 4).map((g) => (
          <button key={title + g.symbol} onClick={() => onPick(g.symbol)}
            className="w-full flex items-center justify-between hover:bg-white/5 px-1 py-1 rounded">
            <span className="font-medium text-white text-[11px] truncate">{clean(g.symbol)}</span>
            <span className={`${color} font-mono text-[10px]`}>{g.changePercent >= 0 ? "+" : ""}{g.changePercent.toFixed(1)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// ONCHAIN EXPLORER — search / trending / new tokens across all chains
// ============================================================================
type OnchainTok = {
  chain: string; address: string; name: string; symbol: string; icon?: string;
  price?: number; priceChange24h?: number; liquidityUsd?: number; volume24h?: number;
  fdv?: number; marketCap?: number; pairAddress?: string; dex?: string; pairUrl?: string;
  createdAt?: number; description?: string;
};

const CHAIN_COLORS: Record<string, string> = {
  ethereum: "bg-blue-500/25 text-blue-300",
  bsc: "bg-yellow-500/25 text-yellow-300",
  solana: "bg-fuchsia-500/25 text-fuchsia-300",
  cronos: "bg-sky-500/25 text-sky-300",
  base: "bg-cyan-500/25 text-cyan-300",
  arbitrum: "bg-indigo-500/25 text-indigo-300",
  polygon: "bg-violet-500/25 text-violet-300",
  avalanche: "bg-rose-500/25 text-rose-300",
  optimism: "bg-red-500/25 text-red-300",
  sui: "bg-teal-500/25 text-teal-300",
  ton: "bg-blue-400/25 text-blue-200",
};

function ChainTag({ chain }: { chain: string }) {
  const cls = CHAIN_COLORS[chain] ?? "bg-slate-500/25 text-slate-300";
  return <span className={`text-[8px] font-mono uppercase px-1 py-px rounded ${cls}`}>{chain}</span>;
}

function OnchainExplorer() {
  const [mode, setMode] = useState<"trending" | "new" | "search">("trending");
  const [query, setQuery] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => { const t = setTimeout(() => setDq(query.trim()), 350); return () => clearTimeout(t); }, [query]);
  const [selected, setSelected] = useState<OnchainTok | null>(null);

  const trending = useQuery({ queryKey: ["onchain-trending"], queryFn: () => getOnchainTrending(), refetchInterval: 60_000, enabled: mode === "trending" });
  const newTokens = useQuery({ queryKey: ["onchain-new"], queryFn: () => getOnchainNew(), refetchInterval: 60_000, enabled: mode === "new" });
  const searchQ = useQuery({
    queryKey: ["onchain-search", dq],
    queryFn: () => searchOnchain({ data: { query: dq } }),
    enabled: mode === "search" && dq.length >= 2,
  });

  const list: OnchainTok[] = mode === "trending" ? (trending.data ?? []) : mode === "new" ? (newTokens.data ?? []) : (searchQ.data ?? []);
  const loading = mode === "trending" ? trending.isLoading : mode === "new" ? newTokens.isLoading : searchQ.isLoading;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="p-3 border-b border-white/5 space-y-2">
        <SegmentedTabs
          value={mode}
          onChange={(v) => setMode(v as typeof mode)}
          items={[
            { value: "trending", label: "Trending", icon: <Flame className="h-3.5 w-3.5" /> },
            { value: "new", label: "New", icon: <Sparkles className="h-3.5 w-3.5" /> },
            { value: "search", label: "Search", icon: <Search className="h-3.5 w-3.5" /> },
          ]}
        />
        {mode === "search" && (
          <div className="relative">
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Contract, symbol, or name (any chain)…"
              className="w-full glass rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-slate-500" />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          </div>
        )}
        <div className="text-[9px] font-mono text-slate-500 flex items-center gap-1">
          <Link2 className="h-2.5 w-2.5" /> DexScreener + GeckoTerminal · Cronos · ETH · SOL · BSC · Base · Arbitrum · Polygon · +30 more
        </div>
      </div>
      {loading && !list.length ? (
        <div className="p-4 text-[11px] text-slate-500 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Scanning onchain…</div>
      ) : !list.length ? (
        <div className="p-4 text-[11px] text-slate-500">{mode === "search" ? "Type at least 2 characters." : "No tokens right now."}</div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {list.map((t) => {
            const up = (t.priceChange24h ?? 0) >= 0;
            return (
              <button key={`${t.chain}:${t.address}`} onClick={() => setSelected(t)}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition text-left border-b border-white/5 min-h-[56px]">
                {t.icon ? (
                  <img src={t.icon} alt="" className="h-7 w-7 rounded-full bg-white/5 shrink-0" onError={(e) => ((e.currentTarget.style.display = "none"))} />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-white/10 grid place-items-center text-[10px] font-bold text-white shrink-0">{t.symbol.slice(0, 2)}</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white truncate">{t.symbol}</span>
                    <ChainTag chain={t.chain} />
                  </div>
                  <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                    {t.name} · Liq ${Math.round(t.liquidityUsd ?? 0).toLocaleString()}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-mono text-slate-200">${fmt(t.price)}</div>
                  <div className={`text-[10px] font-mono ${up ? "text-emerald-400" : "text-rose-400"}`}>
                    {t.priceChange24h != null ? `${up ? "+" : ""}${t.priceChange24h.toFixed(2)}%` : "—"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {selected && <OnchainDetailModal token={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function OnchainDetailModal({ token, onClose }: { token: OnchainTok; onClose: () => void }) {
  const detailQ = useQuery({
    queryKey: ["onchain-detail", token.chain, token.address],
    queryFn: () => getOnchainToken({ data: { address: token.address, chain: token.chain } }),
    refetchInterval: 15_000,
  });
  const d = detailQ.data;
  const pair = d?.token.pairAddress ?? token.pairAddress;

  const candlesQ = useQuery({
    queryKey: ["onchain-candles", token.chain, pair],
    queryFn: () => getOnchainCandles({ data: { chain: token.chain, poolAddress: pair!, timeframe: "hour", aggregate: 1, limit: 168 } }),
    enabled: !!pair,
    refetchInterval: 30_000,
  });
  const tradesQ = useQuery({
    queryKey: ["onchain-trades", token.chain, pair],
    queryFn: () => getOnchainTrades({ data: { chain: token.chain, poolAddress: pair! } }),
    enabled: !!pair,
    refetchInterval: 15_000,
  });

  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!chartRef.current || !candlesQ.data?.length) return;
    const el = chartRef.current;
    const chart = createChart(el, {
      width: el.clientWidth, height: 280,
      layout: { background: { color: "transparent" }, textColor: "rgba(226,232,240,0.8)", fontFamily: "ui-monospace, monospace" },
      grid: { vertLines: { color: "rgba(148,163,184,0.05)" }, horzLines: { color: "rgba(148,163,184,0.05)" } },
      timeScale: { timeVisible: true, borderColor: "rgba(148,163,184,0.15)" },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.15)" },
      crosshair: { mode: 0 },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981", downColor: "#f43f5e", borderUpColor: "#10b981", borderDownColor: "#f43f5e",
      wickUpColor: "#10b981", wickDownColor: "#f43f5e",
    });
    series.setData(candlesQ.data.map((c) => ({ time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close })));
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);
    return () => { ro.disconnect(); chart.remove(); };
  }, [candlesQ.data]);

  const ai = useMutation({
    mutationFn: () => aiOnchainAnalyze({ data: {
      token: d?.token ?? token,
      txns24h: d?.txns24h,
      priceChange: d?.priceChange as any,
    } }),
  });

  const copyAddr = () => { navigator.clipboard.writeText(token.address).catch(() => {}); };
  const tok = d?.token ?? token;
  const ageDays = tok.createdAt ? (Date.now() - tok.createdAt) / 86_400_000 : null;

  return (
    <DraggableModal onClose={onClose} title={`${tok.symbol} · ${tok.name}`} width={880}>
        <div className="p-4 border-b border-white/10 flex items-start gap-3">
          {tok.icon ? (
            <img src={tok.icon} alt="" className="h-11 w-11 rounded-full bg-white/5 shrink-0" />
          ) : (
            <div className="h-11 w-11 rounded-full bg-white/10 grid place-items-center text-sm font-bold text-white shrink-0">{tok.symbol.slice(0, 2)}</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold text-white">{tok.symbol}</span>
              <span className="text-xs text-slate-400 truncate">{tok.name}</span>
              <ChainTag chain={tok.chain} />
              {tok.dex && <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/5 text-slate-400">{tok.dex}</span>}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
              <span className="truncate max-w-[220px] sm:max-w-none">{tok.address}</span>
              <button onClick={copyAddr} className="hover:text-white shrink-0 tap" title="Copy address"><Copy className="h-3 w-3" /></button>
              {tok.pairUrl && <a href={tok.pairUrl} target="_blank" rel="noreferrer" className="hover:text-white shrink-0" title="Open on DexScreener"><ExternalLink className="h-3 w-3" /></a>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 border-b border-white/5">
          <Stat label="Price" value={`$${fmt(tok.price)}`} highlight={(tok.priceChange24h ?? 0) >= 0 ? "up" : "down"} sub={tok.priceChange24h != null ? `${tok.priceChange24h >= 0 ? "+" : ""}${tok.priceChange24h.toFixed(2)}% 24h` : ""} />
          <Stat label="Liquidity" value={`$${Math.round(tok.liquidityUsd ?? 0).toLocaleString()}`} />
          <Stat label="Volume 24h" value={`$${Math.round(tok.volume24h ?? 0).toLocaleString()}`} />
          <Stat label="FDV" value={tok.fdv ? `$${Math.round(tok.fdv).toLocaleString()}` : "—"} sub={ageDays != null ? `Age ${ageDays.toFixed(1)}d` : ""} />
        </div>

        <div className="p-4 border-b border-white/5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Price · 1h candles (USD)</div>
          {!pair ? <div className="text-xs text-slate-500">No pool available.</div>
            : candlesQ.isLoading ? <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading candles…</div>
            : !candlesQ.data?.length ? <div className="text-xs text-slate-500">No candle data on this pool yet.</div>
            : <div ref={chartRef} className="w-full" style={{ height: 280 }} />}
        </div>

        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Shield className="h-3 w-3" /> AI Risk & Path</div>
            <button onClick={() => ai.mutate()} disabled={ai.isPending}
              className="text-[10px] font-bold uppercase px-3 py-1.5 rounded-full flex items-center gap-1"
              style={{ background: "var(--grad-neon)", color: "var(--primary-foreground)" }}>
              {ai.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
              {ai.isPending ? "Thinking" : "Analyze"}
            </button>
          </div>
          {ai.data && (
            <div className="glass rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="font-mono text-slate-400">Risk</span>
                <div className="flex-1 h-1.5 rounded bg-white/10 overflow-hidden">
                  <div className={`h-full ${ai.data.risk >= 70 ? "bg-rose-500" : ai.data.risk >= 40 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${ai.data.risk}%` }} />
                </div>
                <span className="font-mono font-bold text-white">{ai.data.risk}/100</span>
                <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${ai.data.risk >= 70 ? "bg-rose-500/25 text-rose-300" : ai.data.risk >= 40 ? "bg-amber-500/25 text-amber-300" : "bg-emerald-500/25 text-emerald-300"}`}>{ai.data.riskLabel}</span>
              </div>
              {ai.data.reasons.length > 0 && (
                <div className="text-[10px] font-mono text-slate-400">Flags: {ai.data.reasons.join(" · ")}</div>
              )}
              {ai.data.thesis && (
                <div className="prose prose-invert prose-sm max-w-none text-[12px] whitespace-pre-wrap text-slate-200">{ai.data.thesis}</div>
              )}
            </div>
          )}
          {!ai.data && <p className="text-[11px] text-slate-500">Click Analyze for a deterministic risk score + AI thesis with bull/base/bear path, entry, and invalidation.</p>}
        </div>

        <div className="p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Recent trades</div>
          {tradesQ.isLoading ? <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div>
            : !tradesQ.data?.length ? <div className="text-xs text-slate-500">No trades yet.</div>
            : (
              <div className="text-[10px] font-mono max-h-[240px] overflow-y-auto">
                <div className="grid grid-cols-4 gap-2 text-slate-500 border-b border-white/5 pb-1 mb-1 uppercase tracking-wider">
                  <span>Time</span><span>Side</span><span className="text-right">Price</span><span className="text-right">USD</span>
                </div>
                {tradesQ.data.map((t, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 py-0.5 hover:bg-white/5 rounded">
                    <span className="text-slate-400">{new Date(t.blockTimestamp).toLocaleTimeString()}</span>
                    <span className={t.kind === "buy" ? "text-emerald-400" : "text-rose-400"}>{t.kind.toUpperCase()}</span>
                    <span className="text-right text-slate-200">${fmt(t.priceUsd)}</span>
                    <span className="text-right text-slate-300">${Math.round(t.volumeUsd).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
        </div>

        {d?.allPairs && d.allPairs.length > 1 && (
          <div className="p-4 border-t border-white/5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Liquidity pools ({d.allPairs.length})</div>
            <div className="space-y-1 max-h-[180px] overflow-y-auto text-[11px] font-mono">
              {d.allPairs.slice(0, 12).map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-white/5">
                  <span className="text-slate-300 truncate">{p.dex} · {tok.symbol}/{p.quote}</span>
                  <ChainTag chain={p.chain} />
                  <span className="text-slate-400">${Math.round(p.liquidityUsd).toLocaleString()}</span>
                  <ExternalLink className="h-3 w-3 text-slate-500 shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}
    </DraggableModal>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: "up" | "down" }) {
  return (
    <div className="glass rounded-xl p-2.5">
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-sm font-mono font-bold ${highlight === "up" ? "text-emerald-400" : highlight === "down" ? "text-rose-400" : "text-white"}`}>{value}</div>
      {sub && <div className="text-[9px] font-mono text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ============================================================================
// SEGMENTED TABS — sliding indicator, keyboard + touch friendly
// ============================================================================
function SegmentedTabs({ value, onChange, items }: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string; icon?: React.ReactNode }[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  useEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return;
    const active = wrap.querySelector<HTMLButtonElement>(`[data-active="true"]`);
    if (!active) return;
    const wrapRect = wrap.getBoundingClientRect();
    const r = active.getBoundingClientRect();
    setThumb({ left: r.left - wrapRect.left, width: r.width });
  }, [value, items.length]);
  return (
    <div ref={wrapRef} className="seg-track" role="tablist">
      {thumb && <span className="seg-thumb" style={{ left: thumb.left, width: thumb.width }} />}
      {items.map((it) => (
        <button key={it.value} role="tab" data-active={value === it.value}
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)} className="seg-btn tap">
          {it.icon}
          <span className="truncate">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// DRAGGABLE MODAL — moveable on desktop, bottom sheet on mobile, minimizable
// ============================================================================
function DraggableModal({ onClose, title, width = 720, children }: {
  onClose: () => void; title: string; width?: number; children: React.ReactNode;
}) {
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const on = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", on);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("resize", on); window.removeEventListener("keydown", esc); };
  }, [onClose]);

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [minimized, setMinimized] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    if (isMobile || pos) return;
    const w = Math.min(width, window.innerWidth - 40);
    const h = Math.min(window.innerHeight * 0.86, 780);
    setPos({ x: Math.max(20, (window.innerWidth - w) / 2), y: Math.max(20, (window.innerHeight - h) / 2) });
  }, [isMobile, width, pos]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (isMobile || !pos) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const x = Math.max(-40, Math.min(window.innerWidth - 80, e.clientX - dragRef.current.dx));
    const y = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragRef.current.dy));
    setPos({ x, y });
  };
  const onPointerUp = () => { dragRef.current = null; };

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm pb-safe" onClick={onClose}>
        <div className="drag-modal w-full max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl rounded-b-none" style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-white/10">
            <div className="mx-auto h-1 w-10 rounded-full bg-white/25" />
            <button onClick={onClose} className="absolute right-3 top-3 tap p-1.5 rounded-lg text-slate-300 hover:bg-white/10"><X className="h-4 w-4" /></button>
          </div>
          <div className="px-4 py-1 text-[11px] font-mono text-slate-400 border-b border-white/5 truncate">{title}</div>
          <div className="flex-1 overflow-y-auto scroll-thin overscroll-contain">{children}</div>
        </div>
      </div>
    );
  }

  const w = Math.min(width, window.innerWidth - 40);
  const h = minimized ? 56 : Math.min(window.innerHeight * 0.86, 780);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="drag-modal flex flex-col overflow-hidden"
        style={{ left: pos?.x ?? 0, top: pos?.y ?? 0, width: w, height: h }}>
        <div className="drag-handle flex items-center gap-2 px-3 h-11 border-b border-white/10 bg-white/5"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <span className="flex gap-1.5 shrink-0">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          </span>
          <span className="text-[11px] font-mono text-slate-300 truncate flex-1 text-center px-2">{title}</span>
          <button onClick={() => setMinimized((m) => !m)} title={minimized ? "Restore" : "Minimize"}
            className="tap p-1.5 rounded-lg text-slate-300 hover:bg-white/10"><Minus className="h-3.5 w-3.5" /></button>
          <button onClick={onClose} title="Close"
            className="tap p-1.5 rounded-lg text-slate-300 hover:bg-rose-500/25 hover:text-rose-200"><X className="h-4 w-4" /></button>
        </div>
        {!minimized && <div className="flex-1 overflow-y-auto scroll-thin">{children}</div>}
      </div>
    </>
  );
}

// ============================================================================
// INSTALL MODAL — PWA install prompt + per-OS instructions
// ============================================================================
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
function InstallModal({ onClose }: { onClose: () => void }) {
  const [ua, setUA] = useState<{ ios: boolean; android: boolean; windows: boolean; mac: boolean; standalone: boolean }>(
    { ios: false, android: false, windows: false, mac: false, standalone: false });
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [os, setOs] = useState<"ios" | "android" | "windows" | "mac">("android");

  useEffect(() => {
    const u = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(u) && !(window as any).MSStream;
    const android = /Android/i.test(u);
    const windows = /Windows/i.test(u);
    const mac = /Macintosh/i.test(u) && !ios;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    setUA({ ios, android, windows, mac, standalone });
    setOs(ios ? "ios" : android ? "android" : windows ? "windows" : mac ? "mac" : "android");
    const on = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const done = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", on as EventListener);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", on as EventListener);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const res = await deferred.userChoice;
    if (res.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  const items = [
    { value: "ios", label: "iPhone" },
    { value: "android", label: "Android" },
    { value: "windows", label: "Windows" },
    { value: "mac", label: "macOS" },
  ];

  return (
    <DraggableModal onClose={onClose} title="Install Alpha Brain" width={640}>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl grid place-items-center bg-gradient-to-br from-indigo-500 via-cyan-400 to-emerald-400">
            <Brain className="h-6 w-6 text-black" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold text-sm">Add Alpha Brain to your device</div>
            <div className="text-[11px] text-slate-400">Fullscreen, offline-ready shell, home-screen icon. Works on iOS, Android, Windows &amp; macOS.</div>
          </div>
        </div>

        {ua.standalone ? (
          <div className="glass rounded-xl p-3 text-xs text-emerald-300">✅ Already installed — you're running the app.</div>
        ) : installed ? (
          <div className="glass rounded-xl p-3 text-xs text-emerald-300">✅ Installed. Look for the Alpha Brain icon on your device.</div>
        ) : deferred ? (
          <button onClick={install}
            className="tap w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
            style={{ background: "var(--grad-neon)", color: "var(--primary-foreground)" }}>
            <Download className="h-4 w-4" /> Install now
          </button>
        ) : null}

        <SegmentedTabs value={os} onChange={(v) => setOs(v as typeof os)} items={items} />

        <div className="glass rounded-xl p-3 text-[12px] leading-relaxed text-slate-200 space-y-2">
          {os === "ios" && (
            <>
              <div className="text-white font-semibold text-xs uppercase tracking-wider">iPhone / iPad — Safari</div>
              <ol className="list-decimal ml-5 space-y-1 text-slate-300">
                <li>Tap the <b>Share</b> button (square with arrow up) in Safari.</li>
                <li>Scroll and tap <b>Add to Home Screen</b>.</li>
                <li>Tap <b>Add</b> — Alpha Brain now lives on your home screen like a native app.</li>
              </ol>
            </>
          )}
          {os === "android" && (
            <>
              <div className="text-white font-semibold text-xs uppercase tracking-wider">Android — Chrome / Edge</div>
              <ol className="list-decimal ml-5 space-y-1 text-slate-300">
                <li>Tap the <b>⋮</b> menu in the browser toolbar.</li>
                <li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>
                <li>Confirm — the app opens fullscreen from your launcher.</li>
              </ol>
            </>
          )}
          {os === "windows" && (
            <>
              <div className="text-white font-semibold text-xs uppercase tracking-wider">Windows 10 / 11 — Chrome / Edge</div>
              <ol className="list-decimal ml-5 space-y-1 text-slate-300">
                <li>Click the <b>install icon</b> (⊕ or monitor with down arrow) in the address bar.</li>
                <li>Or open the browser menu → <b>Apps → Install this site as an app</b>.</li>
                <li>Alpha Brain gets its own window, taskbar icon, and Start-menu entry.</li>
              </ol>
            </>
          )}
          {os === "mac" && (
            <>
              <div className="text-white font-semibold text-xs uppercase tracking-wider">macOS — Safari 17+ / Chrome</div>
              <ol className="list-decimal ml-5 space-y-1 text-slate-300">
                <li>Safari: <b>File → Add to Dock…</b> and confirm.</li>
                <li>Chrome/Edge: address-bar <b>install</b> icon, or menu → <b>Cast, Save & Share → Install</b>.</li>
                <li>Launch it from Launchpad or the Dock like any Mac app.</li>
              </ol>
            </>
          )}
        </div>

        <div className="text-[10px] font-mono text-slate-500">
          Tip: enable browser <b>Notifications</b> so price alerts fire even when the app is in the background.
        </div>
      </div>
    </DraggableModal>
  );
}

// ============================================================================
// PANEL SHELL — wraps a panel with close (×) + optional pop-out (⤢) buttons
// Buttons float in the top-right, non-intrusive, tap-friendly.
// ============================================================================
function PanelShell({ children, onClose, onPop }: {
  children: React.ReactNode; onClose: () => void; onPop?: () => void;
}) {
  return (
    <div className="relative group">
      <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-70 group-hover:opacity-100 transition">
        {onPop && (
          <button onClick={onPop} title="Open in floating window"
            className="tap p-1.5 rounded-lg glass-strong text-slate-300 hover:text-white hover:bg-white/15">
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
        <button onClick={onClose} title="Close panel"
          className="tap p-1.5 rounded-lg glass-strong text-slate-300 hover:bg-rose-500/25 hover:text-rose-200">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}

function PanelRestoreBar({ hidden, onRestore }: {
  hidden: { chart: boolean; scan: boolean; ai: boolean };
  onRestore: (k: "chart" | "scan" | "ai") => void;
}) {
  const items: Array<{ k: "chart" | "scan" | "ai"; label: string; icon: React.ReactNode }> = [
    { k: "chart", label: "Chart", icon: <Activity className="h-3 w-3" /> },
    { k: "scan", label: "Scanner", icon: <Sparkles className="h-3 w-3" /> },
    { k: "ai", label: "AI Analyst", icon: <Brain className="h-3 w-3" /> },
  ];
  const shown = items.filter((i) => hidden[i.k]);
  if (!shown.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
      <span className="text-slate-500">Hidden:</span>
      {shown.map((i) => (
        <button key={i.k} onClick={() => onRestore(i.k)}
          className="tap glass-pill hover:bg-white/10 px-2.5 py-1 rounded-full flex items-center gap-1">
          <Plus className="h-3 w-3 text-primary" /> {i.icon} {i.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// ASSET DETAIL MODAL — stocks/crypto detail, same style as Onchain modal
// Draggable, closeable, with candle chart + inline AI analyst + pin action.
// ============================================================================
function AssetDetailModal({ asset, onClose, onPin }: {
  asset: Watch; onClose: () => void; onPin: (w: Watch) => void;
}) {
  const quoteQ = useQuery({
    queryKey: ["detail-quote", asset.kind, asset.symbol],
    queryFn: () => asset.kind === "stock"
      ? getStockQuote({ data: { symbol: asset.symbol } })
      : getCryptoQuote({ data: { symbol: asset.symbol } }),
    refetchInterval: 15_000,
  });
  const candlesQ = useQuery({
    queryKey: ["detail-candles", asset.kind, asset.symbol],
    queryFn: () => asset.kind === "stock"
      ? getStockCandles({ data: { symbol: asset.symbol, days: 90 } })
      : getCryptoCandles({ data: { symbol: asset.symbol, interval: "1h", limit: 240 } }),
    refetchInterval: 30_000,
  });

  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!chartRef.current || !candlesQ.data?.length) return;
    const el = chartRef.current;
    const chart = createChart(el, {
      width: el.clientWidth, height: 300,
      layout: { background: { color: "transparent" }, textColor: "rgba(226,232,240,0.8)", fontFamily: "ui-monospace, monospace" },
      grid: { vertLines: { color: "rgba(148,163,184,0.05)" }, horzLines: { color: "rgba(148,163,184,0.05)" } },
      timeScale: { timeVisible: true, borderColor: "rgba(148,163,184,0.15)" },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.15)" },
      crosshair: { mode: 0 },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981", downColor: "#f43f5e", borderUpColor: "#10b981", borderDownColor: "#f43f5e",
      wickUpColor: "#10b981", wickDownColor: "#f43f5e",
    });
    series.setData(candlesQ.data.map((c) => ({ time: c.time as never, open: c.open, high: c.high, low: c.low, close: c.close })));
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);
    return () => { ro.disconnect(); chart.remove(); };
  }, [candlesQ.data]);

  const [aiText, setAiText] = useState("");
  const [q, setQ] = useState("");
  const ai = useMutation({
    mutationFn: (question?: string) => aiAnalyze({
      data: {
        assets: quoteQ.data ? [{ symbol: asset.symbol, kind: asset.kind, price: quoteQ.data.price, changePercent: quoteQ.data.changePercent, high: quoteQ.data.high, low: quoteQ.data.low }] : [],
        symbol: asset.symbol,
        candles: candlesQ.data ?? undefined,
        question,
      },
    }),
    onSuccess: (r) => setAiText(r.analysis),
  });

  const price = quoteQ.data?.price;
  const chg = quoteQ.data?.changePercent;
  const up = (chg ?? 0) >= 0;

  return (
    <DraggableModal onClose={onClose} title={`${clean(asset.symbol)} · ${asset.kind.toUpperCase()}`} width={920}>
      <div className="p-4 border-b border-white/10 flex items-start gap-3 flex-wrap">
        <div className="h-11 w-11 rounded-full bg-white/10 grid place-items-center text-sm font-bold text-white shrink-0">
          {clean(asset.symbol).slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-white">{clean(asset.symbol)}</span>
            <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${asset.kind === "crypto" ? "bg-indigo-500/25 text-indigo-300" : "bg-cyan-500/25 text-cyan-300"}`}>{asset.kind}</span>
            {asset.label && <span className="text-xs text-slate-400 truncate">{asset.label}</span>}
          </div>
          <div className="mt-1 text-[10px] font-mono text-slate-500">
            {asset.kind === "crypto" ? "Crypto.com Exchange · live" : "Finnhub · live"}
          </div>
        </div>
        <button onClick={() => onPin(asset)}
          className="tap text-[10px] font-bold uppercase px-3 py-1.5 rounded-full flex items-center gap-1 shrink-0"
          style={{ background: "var(--grad-neon)", color: "var(--primary-foreground)" }}>
          <Plus className="h-3 w-3" /> Pin to chart
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 border-b border-white/5">
        <Stat label="Price" value={price != null ? `$${fmt(price)}` : "—"} highlight={up ? "up" : "down"}
          sub={chg != null ? `${up ? "+" : ""}${chg.toFixed(2)}% 24h` : ""} />
        <Stat label="High" value={quoteQ.data?.high != null ? `$${fmt(quoteQ.data.high)}` : "—"} />
        <Stat label="Low" value={quoteQ.data?.low != null ? `$${fmt(quoteQ.data.low)}` : "—"} />
        <Stat label="Type" value={asset.kind === "crypto" ? "Crypto" : "Equity"} sub={asset.symbol} />
      </div>

      <div className="p-4 border-b border-white/5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Price · {asset.kind === "crypto" ? "1h candles" : "daily candles"}</div>
        {candlesQ.isLoading ? <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading candles…</div>
          : !candlesQ.data?.length ? <div className="text-xs text-slate-500">No candle data.</div>
          : <div ref={chartRef} className="w-full" style={{ height: 300 }} />}
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Brain className="h-3 w-3" /> AI Analyst</div>
          <button onClick={() => ai.mutate(undefined)} disabled={ai.isPending}
            className="text-[10px] font-bold uppercase px-3 py-1.5 rounded-full flex items-center gap-1"
            style={{ background: "var(--grad-neon)", color: "var(--primary-foreground)" }}>
            {ai.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {ai.isPending ? "Thinking" : "Analyze"}
          </button>
        </div>
        <div className="glass rounded-xl p-3 text-[12px] whitespace-pre-wrap text-slate-200 min-h-[100px]">
          {ai.error ? <span className="text-rose-400 text-xs">Error: {(ai.error as Error).message}</span>
            : aiText || <span className="text-slate-500 text-xs">Click Analyze for regime read, trend/path prediction with entry/stop/target, or ask a question below.</span>}
        </div>
        <div className="mt-2 flex gap-1.5">
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && q) ai.mutate(q); }}
            placeholder={`Ask about ${clean(asset.symbol)}…`}
            className="flex-1 rounded-lg glass px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-slate-500" />
          <button onClick={() => q && ai.mutate(q)} disabled={ai.isPending || !q}
            className="rounded-lg glass-strong text-xs px-4 py-2 font-bold hover:bg-white/15 disabled:opacity-50">Ask</button>
        </div>
      </div>
    </DraggableModal>
  );
}

