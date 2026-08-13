import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import { getEdgeBoard, getCorrelation } from "../lib/lab.functions";
import { positionSize } from "../lib/lab.server";
import { getStockQuote, getCryptoQuote } from "../lib/market.functions";

export const Route = createFileRoute("/lab")({
  head: () => ({
    meta: [
      { title: "Strategy Lab — Alpha Brain" },
      { name: "description", content: "Edge Board ranking of every tracked stock and token, correlation clustering, risk-first position sizing and a live paper-trade journal — all computed locally, no AI credits." },
      { property: "og:title", content: "Strategy Lab — Alpha Brain" },
      { property: "og:description", content: "Rank the whole market by deterministic edge score, then size and journal the trade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LabPage,
});

// ---------- helpers ----------
const fmt = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a === 0) return "0";
  if (a < 0.00001) return n.toFixed(12).replace(/0+$/, "");
  if (a < 1) return n.toFixed(6);
  if (a < 1000) return n.toFixed(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const gradeColor = (g: string) =>
  g === "A+" ? "text-emerald-300 border-emerald-400/40 bg-emerald-400/10"
    : g === "A" ? "text-emerald-200 border-emerald-400/25 bg-emerald-400/5"
      : g === "B" ? "text-cyan-200 border-cyan-400/25 bg-cyan-400/5"
        : g === "C" ? "text-amber-200 border-amber-400/25 bg-amber-400/5"
          : "text-rose-200 border-rose-400/25 bg-rose-400/5";

type Trade = {
  id: string;
  symbol: string;
  kind: "stock" | "crypto";
  side: "long" | "short";
  entry: number;
  stop: number;
  target: number;
  units: number;
  note: string;
  openedAt: number;
  closedAt?: number;
  exit?: number;
};

const JOURNAL_KEY = "alphabrain.lab.journal.v1";
const SIZER_KEY = "alphabrain.lab.sizer.v1";

function loadJournal(): Trade[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(JOURNAL_KEY) ?? "[]") as Trade[]; } catch { return []; }
}

// ---------- page ----------
function LabPage() {
  const [market, setMarket] = useState<"all" | "stock" | "crypto">("all");
  const [grade, setGrade] = useState<"any" | "A+" | "A" | "B">("any");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [basket, setBasket] = useState<Array<{ symbol: string; kind: "stock" | "crypto" }>>([]);
  const [journal, setJournal] = useState<Trade[]>([]);
  const [equity, setEquity] = useState(10000);
  const [riskPct, setRiskPct] = useState(1);

  useEffect(() => {
    setJournal(loadJournal());
    try {
      const s = JSON.parse(localStorage.getItem(SIZER_KEY) ?? "null");
      if (s) { setEquity(s.equity ?? 10000); setRiskPct(s.riskPct ?? 1); }
    } catch { /* ignore */ }
  }, []);

  const saveJournal = (next: Trade[]) => {
    setJournal(next);
    try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  useEffect(() => {
    try { localStorage.setItem(SIZER_KEY, JSON.stringify({ equity, riskPct })); } catch { /* ignore */ }
  }, [equity, riskPct]);

  const board = useQuery({
    queryKey: ["edge-board", market],
    queryFn: () => getEdgeBoard({ data: { market, limit: 80 } }),
    refetchInterval: 45_000,
    staleTime: 20_000,
  });

  const rows = useMemo(() => {
    const all = board.data?.longs ?? [];
    const needle = q.trim().toUpperCase();
    return all.filter((r) =>
      (grade === "any" || r.grade === grade || (grade === "A" && r.grade === "A+")) &&
      (!needle || r.symbol.includes(needle) || (r.name ?? "").toUpperCase().includes(needle)),
    );
  }, [board.data, grade, q]);

  const corr = useQuery({
    queryKey: ["lab-corr", basket.map((b) => b.symbol).join(",")],
    queryFn: () => getCorrelation({ data: { assets: basket } }),
    enabled: basket.length >= 2,
    staleTime: 60_000,
  });

  const openTrades = journal.filter((t) => !t.closedAt);
  const liveQuotes = useQueries({
    queries: openTrades.map((t) => ({
      queryKey: ["lab-quote", t.kind, t.symbol],
      queryFn: () => (t.kind === "crypto" ? getCryptoQuote({ data: { symbol: t.symbol } }) : getStockQuote({ data: { symbol: t.symbol } })),
      refetchInterval: 15_000,
      staleTime: 10_000,
    })),
  });
  const priceOf = (sym: string) => {
    const idx = openTrades.findIndex((t) => t.symbol === sym);
    return idx >= 0 ? (liveQuotes[idx]?.data?.price ?? 0) : 0;
  };

  const stats = useMemo(() => {
    const closed = journal.filter((t) => t.closedAt && t.exit);
    const pnl = closed.map((t) => (t.side === "long" ? (t.exit! - t.entry) : (t.entry - t.exit!)) * t.units);
    const wins = pnl.filter((p) => p > 0);
    const total = pnl.reduce((a, b) => a + b, 0);
    const grossWin = wins.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(pnl.filter((p) => p <= 0).reduce((a, b) => a + b, 0));
    const openPnl = openTrades.reduce((sum, t) => {
      const p = priceOf(t.symbol);
      if (!p) return sum;
      return sum + (t.side === "long" ? p - t.entry : t.entry - p) * t.units;
    }, 0);
    return {
      closed: closed.length,
      winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
      realised: total,
      openPnl,
      profitFactor: grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
      expectancy: closed.length ? total / closed.length : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journal, liveQuotes.map((q) => q.data?.price).join(",")]);

  const toggleBasket = (symbol: string, kind: "stock" | "crypto") => {
    setBasket((prev) =>
      prev.find((b) => b.symbol === symbol)
        ? prev.filter((b) => b.symbol !== symbol)
        : prev.length >= 8 ? prev : [...prev, { symbol, kind }],
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 glass-strong border-b border-white/5">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-3">
          <a href="/" className="tap text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground">← Terminal</a>
          <h1 className="text-base sm:text-lg font-bold tracking-tight">🧪 Strategy Lab</h1>
          <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-emerald-400/30 text-emerald-300 bg-emerald-400/10">
            Local engine · 0 credits
          </span>
          <div className="ml-auto flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {board.data && (
              <>
                <span>{board.data.universe} assets</span>
                <span className="text-muted-foreground/50">·</span>
                <span>breadth {board.data.breadth}%</span>
                <span className="text-muted-foreground/50">·</span>
                <span className={board.data.regime === "risk-on" ? "text-emerald-300" : board.data.regime === "risk-off" ? "text-rose-300" : "text-amber-300"}>
                  {board.data.regime}
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6 pb-28">
        <p className="text-sm text-muted-foreground max-w-3xl">
          The Lab ranks the whole tracked universe with a deterministic edge model (momentum z-score vs peers, position inside the
          day range, liquidity percentile, quality/risk scores), then hands you the plan, the size and a journal to prove it.
          Nothing here calls a language model — the math is reproducible and free. Not financial advice.
        </p>

        {/* ------- Edge Board ------- */}
        <section className="glass rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <h2 className="text-sm font-bold uppercase tracking-widest">Edge Board</h2>
            <div className="flex rounded-full glass-pill p-0.5 text-[11px] font-semibold">
              {(["all", "stock", "crypto"] as const).map((m) => (
                <button key={m} onClick={() => setMarket(m)}
                  className={`tap px-3 py-1 rounded-full capitalize transition ${market === m ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {m}
                </button>
              ))}
            </div>
            <div className="flex rounded-full glass-pill p-0.5 text-[11px] font-semibold">
              {(["any", "A+", "A", "B"] as const).map((g) => (
                <button key={g} onClick={() => setGrade(g)}
                  className={`tap px-3 py-1 rounded-full transition ${grade === g ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {g === "any" ? "All grades" : g}
                </button>
              ))}
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter symbol…"
              className="ml-auto h-8 w-40 rounded-lg bg-white/5 border border-white/10 px-3 text-xs outline-none focus:border-cyan-400/40" />
          </div>

          {board.isLoading && <div className="py-10 text-center text-xs font-mono text-muted-foreground animate-pulse">Scoring the universe…</div>}
          {board.isError && <div className="py-6 text-center text-xs text-rose-300">Data providers are rate-limited. Retrying automatically.</div>}

          <div className="space-y-1.5">
            {rows.map((r) => {
              const isOpen = open === r.symbol;
              const inBasket = !!basket.find((b) => b.symbol === r.symbol);
              const size = positionSize({ equity, riskPct, entry: r.plan.entry, stop: r.plan.stop });
              return (
                <div key={`${r.kind}-${r.symbol}`} className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                  <button onClick={() => setOpen(isOpen ? null : r.symbol)} className="tap w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.04] transition">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${gradeColor(r.grade)}`}>{r.grade}</span>
                    <span className="font-mono font-bold text-sm w-28 truncate">{r.symbol}</span>
                    <span className="hidden sm:block text-xs text-muted-foreground w-36 truncate">{r.name}</span>
                    <span className="text-xs font-mono w-28 truncate">{fmt(r.price)}</span>
                    <span className={`text-xs font-mono w-20 ${r.changePercent >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{pct(r.changePercent)}</span>
                    <span className="hidden md:block text-[10px] font-mono uppercase tracking-wider text-muted-foreground w-36">{r.phase}</span>
                    <span className="ml-auto flex items-center gap-2">
                      {r.chaseRisk && <span className="text-[9px] font-mono uppercase text-amber-300">chase risk</span>}
                      <span className="h-1.5 w-20 rounded-full bg-white/10 overflow-hidden hidden sm:block">
                        <span className="block h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${Math.max(4, (r.edge + 100) / 2)}%` }} />
                      </span>
                      <span className="text-xs font-mono font-bold w-10 text-right">{r.edge}</span>
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 grid gap-3 md:grid-cols-3 border-t border-white/5">
                      <div className="md:col-span-2">
                        <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">Why this score</h4>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {r.reasons.map((why, i) => <li key={i}>• {why}</li>)}
                        </ul>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button onClick={() => toggleBasket(r.symbol, r.kind)}
                            className={`tap text-[11px] px-3 py-1.5 rounded-lg border transition ${inBasket ? "border-cyan-400/40 text-cyan-200 bg-cyan-400/10" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>
                            {inBasket ? "In correlation basket" : "Add to correlation basket"}
                          </button>
                          <button
                            onClick={() => saveJournal([{
                              id: `${Date.now()}-${r.symbol}`,
                              symbol: r.symbol, kind: r.kind,
                              side: r.edge >= 0 ? "long" : "short",
                              entry: r.plan.entry, stop: r.plan.stop, target: r.plan.target2,
                              units: Number(size.units.toFixed(6)),
                              note: `${r.grade} · ${r.phase} · edge ${r.edge}`,
                              openedAt: Date.now(),
                            }, ...journal])}
                            className="tap text-[11px] px-3 py-1.5 rounded-lg border border-emerald-400/30 text-emerald-200 bg-emerald-400/10 hover:bg-emerald-400/20">
                            Paper trade this plan
                          </button>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs font-mono space-y-1">
                        <Row k="Entry" v={fmt(r.plan.entry)} />
                        <Row k="Stop" v={fmt(r.plan.stop)} tone="bad" />
                        <Row k="Target 1" v={fmt(r.plan.target1)} tone="good" />
                        <Row k="Target 2" v={fmt(r.plan.target2)} tone="good" />
                        <Row k="R:R" v={`${r.plan.rr.toFixed(2)}×`} />
                        <div className="h-px bg-white/10 my-1" />
                        <Row k="Size" v={`${size.units.toFixed(size.units < 1 ? 6 : 2)} u`} />
                        <Row k="Notional" v={`$${size.notional.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                        <Row k="Risked" v={`$${size.riskAmount.toFixed(2)}`} />
                        {size.capped && <div className="text-[10px] text-amber-300">Capped at 25% max weight</div>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!board.isLoading && !rows.length && (
              <div className="py-8 text-center text-xs text-muted-foreground">No assets match this filter right now.</div>
            )}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ------- Risk Sizer ------- */}
          <section className="glass rounded-2xl p-4">
            <h2 className="text-sm font-bold uppercase tracking-widest mb-3">Risk Engine</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">
                <span className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Account equity ($)</span>
                <input type="number" value={equity} min={100} onChange={(e) => setEquity(Math.max(100, Number(e.target.value) || 0))}
                  className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 font-mono text-sm outline-none focus:border-cyan-400/40" />
              </label>
              <label className="text-xs">
                <span className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Risk per trade — {riskPct.toFixed(2)}%</span>
                <input type="range" min={0.1} max={5} step={0.1} value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value))} className="w-full accent-cyan-400 h-9" />
              </label>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="Risk / trade" value={`$${(equity * riskPct / 100).toFixed(2)}`} />
              <Stat label="Max weight" value="25%" />
              <Stat label="Ruin buffer" value={`${Math.floor(100 / Math.max(riskPct, 0.1))} losses`} />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Every plan on the Edge Board is sized against these two numbers: units = (equity × risk%) ÷ |entry − stop|, then capped
              at 25% of equity so one volatile token can never dominate the book.
            </p>
          </section>

          {/* ------- Correlation ------- */}
          <section className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-bold uppercase tracking-widest">Correlation Lab</h2>
              <span className="text-[10px] font-mono text-muted-foreground">{basket.length}/8 selected</span>
              {basket.length > 0 && <button onClick={() => setBasket([])} className="tap ml-auto text-[10px] font-mono uppercase text-muted-foreground hover:text-foreground">Clear</button>}
            </div>
            {basket.length < 2 && <p className="text-xs text-muted-foreground">Open any Edge Board row and add two or more assets to see how tightly they move together.</p>}
            {corr.isLoading && <div className="py-6 text-center text-xs font-mono text-muted-foreground animate-pulse">Computing log-return correlations…</div>}
            {corr.data && (
              <>
                <div className="overflow-x-auto">
                  <table className="text-[10px] font-mono w-full">
                    <thead>
                      <tr><th /> {corr.data.symbols.map((s) => <th key={s} className="px-1.5 py-1 text-muted-foreground font-normal">{s.slice(0, 6)}</th>)}</tr>
                    </thead>
                    <tbody>
                      {corr.data.matrix.map((row, i) => (
                        <tr key={i}>
                          <td className="pr-2 text-muted-foreground whitespace-nowrap">{corr.data!.symbols[i].slice(0, 8)}</td>
                          {row.map((v, j) => (
                            <td key={j} className="px-1 py-0.5 text-center rounded"
                              style={{ background: `color-mix(in oklab, ${v >= 0 ? "oklch(0.72 0.17 155)" : "oklch(0.65 0.2 20)"} ${Math.abs(v) * 55}%, transparent)` }}>
                              {i === j ? "—" : v.toFixed(2)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Stat label="Avg |r|" value={corr.data.avgCorrelation.toFixed(2)} />
                  <Stat label="Diversification" value={`${corr.data.diversification}/100`} />
                </div>
                {corr.data.clusters.length > 0 && (
                  <p className="mt-2 text-[11px] text-amber-200">
                    Moving as one: {corr.data.clusters.map((c) => c.join(" + ")).join(" | ")}
                  </p>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">{corr.data.verdict}</p>
              </>
            )}
            {corr.isError && <p className="text-xs text-rose-300">Not enough shared history for these assets.</p>}
          </section>
        </div>

        {/* ------- Journal ------- */}
        <section className="glass rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h2 className="text-sm font-bold uppercase tracking-widest">Paper Journal</h2>
            <span className="text-[10px] font-mono text-muted-foreground">stored on this device only</span>
            {journal.length > 0 && (
              <button onClick={() => saveJournal([])} className="tap ml-auto text-[10px] font-mono uppercase text-muted-foreground hover:text-rose-300">Reset</button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            <Stat label="Open P&L" value={`${stats.openPnl >= 0 ? "+" : ""}$${stats.openPnl.toFixed(2)}`} tone={stats.openPnl >= 0 ? "good" : "bad"} />
            <Stat label="Realised" value={`${stats.realised >= 0 ? "+" : ""}$${stats.realised.toFixed(2)}`} tone={stats.realised >= 0 ? "good" : "bad"} />
            <Stat label="Win rate" value={`${stats.winRate.toFixed(0)}%`} />
            <Stat label="Profit factor" value={Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"} />
            <Stat label="Expectancy" value={`$${stats.expectancy.toFixed(2)}`} />
          </div>

          {!journal.length && <p className="text-xs text-muted-foreground">No trades yet — open an Edge Board row and hit “Paper trade this plan”.</p>}

          <div className="space-y-1.5">
            {journal.map((t) => {
              const live = t.closedAt ? (t.exit ?? 0) : priceOf(t.symbol);
              const pnl = live ? (t.side === "long" ? live - t.entry : t.entry - live) * t.units : 0;
              const rMultiple = Math.abs(t.entry - t.stop) ? (t.side === "long" ? live - t.entry : t.entry - live) / Math.abs(t.entry - t.stop) : 0;
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs font-mono">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase ${t.side === "long" ? "text-emerald-300 bg-emerald-400/10" : "text-rose-300 bg-rose-400/10"}`}>{t.side}</span>
                  <span className="font-bold w-24 truncate">{t.symbol}</span>
                  <span className="text-muted-foreground">in {fmt(t.entry)}</span>
                  <span className="text-muted-foreground">stop {fmt(t.stop)}</span>
                  <span className="text-muted-foreground hidden sm:inline">{live ? `now ${fmt(live)}` : "…"}</span>
                  <span className={pnl >= 0 ? "text-emerald-300" : "text-rose-300"}>{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}</span>
                  <span className="text-muted-foreground">{rMultiple >= 0 ? "+" : ""}{rMultiple.toFixed(2)}R</span>
                  <span className="ml-auto flex gap-2">
                    {!t.closedAt && live > 0 && (
                      <button onClick={() => saveJournal(journal.map((x) => x.id === t.id ? { ...x, closedAt: Date.now(), exit: live } : x))}
                        className="tap text-[10px] uppercase px-2 py-1 rounded border border-white/10 hover:text-foreground text-muted-foreground">Close</button>
                    )}
                    {t.closedAt && <span className="text-[10px] uppercase text-muted-foreground">closed</span>}
                    <button onClick={() => saveJournal(journal.filter((x) => x.id !== t.id))}
                      className="tap text-[10px] uppercase px-2 py-1 rounded border border-white/10 text-muted-foreground hover:text-rose-300">Del</button>
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center pt-4">
          Alpha Brain Strategy Lab · deterministic engine · educational use only ·{" "}
          <a href="/library" className="hover:text-cyan-400">Library</a> · <a href="/disclaimer" className="hover:text-cyan-400">Disclaimer</a>
        </footer>
      </main>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "good" | "bad" }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className={tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : ""}>{v}</span>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-center">
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold font-mono ${tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : ""}`}>{value}</div>
    </div>
  );
}
