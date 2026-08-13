// Alpha Brain — Strategy Lab engine.
// Pure, deterministic, credit-free math. No network, no keys, no storage.

export type LabInput = {
  symbol: string;
  name?: string;
  kind: "stock" | "crypto";
  price: number;
  changePercent: number;
  high?: number;
  low?: number;
  volume?: number;
  confidenceScore?: number;
  riskScore?: number;
};

export type LabPlan = {
  entry: number;
  stop: number;
  target1: number;
  target2: number;
  riskPerUnit: number;
  rr: number;
};

export type LabRow = LabInput & {
  edge: number;              // -100..100 composite
  grade: "A+" | "A" | "B" | "C" | "D";
  phase: "breakout" | "trend-continuation" | "pullback" | "basing" | "distribution" | "capitulation";
  rangePos: number;          // 0..1 position inside the day range
  volatilityPct: number;     // day range as % of price
  liquidityRank: number;     // 0..1 percentile inside its own asset class
  chaseRisk: boolean;
  plan: LabPlan;
  reasons: string[];
};

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

function percentileRanks(values: number[]): number[] {
  const sorted = [...values].map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = new Array(values.length).fill(0);
  sorted.forEach((s, rank) => {
    out[s.i] = values.length > 1 ? rank / (values.length - 1) : 0.5;
  });
  return out;
}

function zScores(values: number[]): number[] {
  const n = values.length || 1;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const varc = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const sd = Math.sqrt(varc) || 1;
  return values.map((v) => (v - mean) / sd);
}

function buildPlan(price: number, vol: number, bullish: boolean): LabPlan {
  const unit = Math.max(price * Math.max(vol, 0.008) * 0.6, price * 0.004);
  const entry = price;
  const stop = bullish ? price - unit * 1.5 : price + unit * 1.5;
  const t1 = bullish ? price + unit * 1.8 : price - unit * 1.8;
  const t2 = bullish ? price + unit * 3.4 : price - unit * 3.4;
  const riskPerUnit = Math.abs(entry - stop);
  return {
    entry,
    stop,
    target1: t1,
    target2: t2,
    riskPerUnit,
    rr: riskPerUnit ? Math.abs(t2 - entry) / riskPerUnit : 0,
  };
}

/** Rank one asset class into edge-scored rows. Relative scoring: ranks are within the list. */
export function scoreUniverse(rows: LabInput[]): LabRow[] {
  const usable = rows.filter((r) => Number.isFinite(r.price) && r.price > 0);
  if (!usable.length) return [];

  const momZ = zScores(usable.map((r) => r.changePercent || 0));
  const volRank = percentileRanks(usable.map((r) => r.volume ?? 0));

  return usable.map((r, i) => {
    const high = r.high && r.high > 0 ? r.high : r.price;
    const low = r.low && r.low > 0 ? r.low : r.price;
    const span = Math.max(high - low, 1e-12);
    const rangePos = clamp((r.price - low) / span, 0, 1);
    const volatilityPct = span / r.price;

    const mom = clamp(momZ[i], -3, 3) / 3;                 // -1..1
    const liq = volRank[i];                                 // 0..1
    const structure = rangePos * 2 - 1;                     // -1..1
    const quality = ((r.confidenceScore ?? 60) - 50) / 50;  // ~-1..1
    const risk = (r.riskScore ?? 30) / 100;                 // 0..1

    let edge =
      mom * 38 +
      structure * 24 +
      liq * 18 +
      quality * 12 -
      risk * 14;

    // Chase penalty: parabolic moves with the price pinned at the day high.
    const chaseRisk = Math.abs(r.changePercent) > 14 && (rangePos > 0.93 || rangePos < 0.07);
    if (chaseRisk) edge -= 12;
    // Illiquid names never earn a top grade.
    if (liq < 0.15) edge -= 10;

    edge = Math.round(clamp(edge, -100, 100));

    const grade: LabRow["grade"] =
      edge >= 55 ? "A+" : edge >= 35 ? "A" : edge >= 12 ? "B" : edge >= -15 ? "C" : "D";

    const phase: LabRow["phase"] =
      r.changePercent > 3 && rangePos > 0.8 ? "breakout"
        : r.changePercent > 0.5 && rangePos > 0.55 ? "trend-continuation"
          : r.changePercent > 0 && rangePos < 0.45 ? "pullback"
            : Math.abs(r.changePercent) <= 0.5 && volatilityPct < 0.03 ? "basing"
              : r.changePercent < -6 ? "capitulation"
                : "distribution";

    const bullish = edge >= 0;
    const reasons: string[] = [];
    reasons.push(`${r.changePercent >= 0 ? "+" : ""}${r.changePercent.toFixed(2)}% session move (${mom >= 0 ? "above" : "below"} class average)`);
    reasons.push(`closing ${(rangePos * 100).toFixed(0)}% up its daily range → ${rangePos > 0.66 ? "buyers in control" : rangePos < 0.33 ? "sellers in control" : "balanced tape"}`);
    reasons.push(`liquidity percentile ${(liq * 100).toFixed(0)} within ${r.kind === "crypto" ? "crypto" : "equity"} universe`);
    reasons.push(`realised day volatility ${(volatilityPct * 100).toFixed(2)}% → stop sized at 1.5× that band`);
    if (chaseRisk) reasons.push("extended move pinned at the extreme — chase risk flagged, wait for a retest");
    if ((r.riskScore ?? 0) > 55) reasons.push(`elevated risk score ${(r.riskScore ?? 0).toFixed(0)}/100 from the quality engine`);

    return {
      ...r,
      edge,
      grade,
      phase,
      rangePos,
      volatilityPct: volatilityPct * 100,
      liquidityRank: liq,
      chaseRisk,
      plan: buildPlan(r.price, volatilityPct, bullish),
      reasons,
    };
  }).sort((a, b) => b.edge - a.edge);
}

/** Pearson correlation of log returns. */
export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const x = a.slice(-n), y = b.slice(-n);
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a1 = x[i] - mx, b1 = y[i] - my;
    num += a1 * b1; dx += a1 * a1; dy += b1 * b1;
  }
  const den = Math.sqrt(dx * dy);
  return den ? clamp(num / den, -1, 1) : 0;
}

export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > 0 && closes[i - 1] > 0) out.push(Math.log(closes[i] / closes[i - 1]));
  }
  return out;
}

export type CorrelationReport = {
  symbols: string[];
  matrix: number[][];
  avgCorrelation: number;
  diversification: number;   // 0..100, higher = better spread
  clusters: string[][];      // groups moving together (|r| >= 0.7)
  verdict: string;
};

export function correlationReport(series: Array<{ symbol: string; closes: number[] }>): CorrelationReport {
  const rets = series.map((s) => ({ symbol: s.symbol, r: logReturns(s.closes) }));
  const n = rets.length;
  const matrix = rets.map((a) => rets.map((b) => (a.symbol === b.symbol ? 1 : Number(pearson(a.r, b.r).toFixed(3)))));

  let sum = 0, count = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { sum += Math.abs(matrix[i][j]); count++; }
  const avg = count ? sum / count : 0;
  const diversification = Math.round(clamp((1 - avg) * 100, 0, 100));

  // Greedy clustering on |r| >= 0.7
  const seen = new Set<number>();
  const clusters: string[][] = [];
  for (let i = 0; i < n; i++) {
    if (seen.has(i)) continue;
    const group = [i];
    for (let j = i + 1; j < n; j++) if (!seen.has(j) && Math.abs(matrix[i][j]) >= 0.7) { group.push(j); seen.add(j); }
    seen.add(i);
    if (group.length > 1) clusters.push(group.map((k) => rets[k].symbol));
  }

  const verdict =
    avg >= 0.75 ? "This basket is effectively one position — a single shock hits every leg at once. Cut to one representative name or add an uncorrelated asset."
      : avg >= 0.45 ? "Moderately correlated. Size each leg as a fraction of one idea, not as independent bets."
        : "Well diversified. Legs move on their own drivers, so independent position sizing is justified.";

  return { symbols: rets.map((r) => r.symbol), matrix, avgCorrelation: Number(avg.toFixed(3)), diversification, clusters, verdict };
}

/** Risk-first position sizing with a volatility-aware cap. */
export function positionSize(opts: {
  equity: number; riskPct: number; entry: number; stop: number; maxWeightPct?: number;
}) {
  const { equity, riskPct, entry, stop } = opts;
  const maxWeightPct = opts.maxWeightPct ?? 25;
  const riskAmount = equity * (riskPct / 100);
  const perUnit = Math.abs(entry - stop);
  const rawUnits = perUnit > 0 ? riskAmount / perUnit : 0;
  const capUnits = entry > 0 ? (equity * (maxWeightPct / 100)) / entry : 0;
  const units = Math.max(0, Math.min(rawUnits, capUnits));
  const notional = units * entry;
  return {
    riskAmount,
    perUnit,
    units,
    notional,
    weightPct: equity ? (notional / equity) * 100 : 0,
    capped: rawUnits > capUnits,
  };
}
