// Alpha Brain — Local Engine.
// A fully deterministic, credit-free analysis engine. It produces the same
// shapes as the AI-gateway paths so the app degrades gracefully (and works
// entirely offline / without any API credits) when the gateway is missing,
// rate-limited, or out of quota.
//
// Pure functions only: no network, no keys, no storage.

export type LocalCandle = { time: number; open: number; high: number; low: number; close: number; volume?: number };

export type LocalAsset = {
  symbol: string;
  kind: "stock" | "crypto";
  price: number;
  changePercent: number;
};

// ---------- indicators ----------
function ema(arr: number[], n: number): number[] {
  if (!arr.length) return [];
  const k = 2 / (n + 1);
  const out = [arr[0]];
  for (let i = 1; i < arr.length; i++) out.push(arr[i] * k + out[i - 1] * (1 - k));
  return out;
}
function sma(arr: number[], n: number): number {
  const s = arr.slice(-n);
  return s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
}
export function localRsi(closes: number[], n = 14): number {
  if (closes.length < n + 1) return 50;
  let gain = 0, loss = 0;
  for (let i = closes.length - n; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  if (loss === 0) return 100;
  const rs = (gain / n) / (loss / n);
  return 100 - 100 / (1 + rs);
}
export function localMacd(closes: number[]) {
  const f = ema(closes, 12), s = ema(closes, 26);
  const line = closes.map((_, i) => (f[i] ?? 0) - (s[i] ?? 0));
  const sig = ema(line, 9);
  const macd = line.at(-1) ?? 0;
  const signal = sig.at(-1) ?? 0;
  return { macd, signal, hist: macd - signal };
}
export function localAtr(c: LocalCandle[], n = 14): number {
  if (c.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < c.length; i++) {
    trs.push(Math.max(c[i].high - c[i].low, Math.abs(c[i].high - c[i - 1].close), Math.abs(c[i].low - c[i - 1].close)));
  }
  return sma(trs, n);
}

function pivots(c: LocalCandle[]) {
  const look = c.slice(-60);
  const highs = look.map((x) => x.high).sort((a, b) => b - a);
  const lows = look.map((x) => x.low).sort((a, b) => a - b);
  return {
    resistance: highs[Math.min(2, highs.length - 1)] ?? 0,
    support: lows[Math.min(2, lows.length - 1)] ?? 0,
  };
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a === 0) return "0";
  if (a < 0.00001) return n.toFixed(12).replace(/0+$/, "");
  if (a < 1) return n.toFixed(6);
  if (a < 1000) return n.toFixed(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export type LocalTechnicals = {
  price: number;
  rsi: number;
  macd: { macd: number; signal: number; hist: number };
  atr: number;
  atrPct: number;
  sma20: number;
  sma50: number;
  sma200: number;
  support: number;
  resistance: number;
  structure: "uptrend" | "downtrend" | "range" | "accumulation";
  momentum: "strong-bull" | "bull" | "neutral" | "bear" | "strong-bear";
  probabilities: { bull: number; base: number; bear: number };
  targets: { bull: number; base: number; bear: number };
  score: number; // -100..100 composite
};

export function analyzeCandles(candles: LocalCandle[]): LocalTechnicals | null {
  if (!candles || candles.length < 10) return null;
  const closes = candles.map((c) => c.close);
  const price = closes.at(-1)!;
  const r = localRsi(closes);
  const m = localMacd(closes);
  const a = localAtr(candles);
  const s20 = sma(closes, 20), s50 = sma(closes, 50), s200 = sma(closes, 200);
  const { support, resistance } = pivots(candles);
  const atrPct = price ? (a / price) * 100 : 0;

  let score = 0;
  score += r > 70 ? 12 : r > 55 ? 20 : r > 45 ? 0 : r > 30 ? -20 : -12;
  score += m.hist > 0 ? 20 : -20;
  score += price > s20 ? 12 : -12;
  score += price > s50 ? 14 : -14;
  if (s200 > 0) score += price > s200 ? 14 : -14;
  const slope = closes.length > 20 ? (price - closes[closes.length - 20]) / (closes[closes.length - 20] || 1) : 0;
  score += Math.max(-20, Math.min(20, slope * 100));
  score = Math.max(-100, Math.min(100, Math.round(score)));

  const structure: LocalTechnicals["structure"] =
    score > 30 ? "uptrend"
      : score < -30 ? "downtrend"
        : Math.abs(slope) < 0.02 && r > 40 && r < 60 ? "accumulation"
          : "range";

  const momentum: LocalTechnicals["momentum"] =
    score > 55 ? "strong-bull" : score > 18 ? "bull" : score > -18 ? "neutral" : score > -55 ? "bear" : "strong-bear";

  // Probability model: map composite score to a normalised distribution.
  const bull = Math.round(Math.max(8, Math.min(72, 33 + score * 0.35)));
  const bear = Math.round(Math.max(8, Math.min(72, 33 - score * 0.35)));
  const base = 100 - bull - bear;

  const vol = Math.max(a, price * 0.01);
  return {
    price, rsi: r, macd: m, atr: a, atrPct,
    sma20: s20, sma50: s50, sma200: s200,
    support, resistance, structure, momentum,
    probabilities: { bull, base, bear },
    targets: { bull: price + vol * 3, base: price + vol * 0.4 * Math.sign(score || 1), bear: price - vol * 3 },
    score,
  };
}

// ---------- narrative generation ----------
export function localBrief(opts: {
  symbol: string;
  assets: LocalAsset[];
  candles?: LocalCandle[];
  question?: string;
}): string {
  const { symbol, assets } = opts;
  const t = opts.candles ? analyzeCandles(opts.candles) : null;
  const ranked = [...assets].sort((a, b) => b.changePercent - a.changePercent);
  const leaders = ranked.slice(0, 3);
  const laggards = ranked.slice(-3).reverse();
  const breadth = assets.length ? ranked.filter((a) => a.changePercent > 0).length / assets.length : 0;
  const regime = breadth > 0.65 ? "risk-on" : breadth < 0.35 ? "risk-off" : "mixed / rotational";

  const head = `_Alpha Brain Local Engine — deterministic quantitative read (no external model). Not financial advice._\n`;

  if (opts.question) {
    return `${head}
## ❓ ${opts.question}

**Direct read on ${symbol}:** ${t ? `structure is **${t.structure}**, momentum **${t.momentum}** (composite ${t.score}/100). RSI ${t.rsi.toFixed(1)}, MACD histogram ${t.macd.hist >= 0 ? "positive" : "negative"} (${fmt(t.macd.hist)}), ATR ${fmt(t.atr)} (${t.atrPct.toFixed(2)}% of price).` : "not enough candle history for a technical read — showing watchlist context only."}

## 📊 Levels
${t ? `- Support: **${fmt(t.support)}**\n- Resistance: **${fmt(t.resistance)}**\n- Invalidation: **${fmt(t.support - t.atr)}**` : "- Load a chart to compute levels."}

## 🧭 Market context
Breadth ${(breadth * 100).toFixed(0)}% positive → regime **${regime}**. Leaders: ${leaders.map((a) => `**${a.symbol}** ${a.changePercent.toFixed(2)}%`).join(", ") || "—"}.`;
  }

  return `${head}
## ⚡ TL;DR
- Bias on **${symbol}**: ${t ? `**${t.momentum}**` : "insufficient data"}${t ? ` (composite ${t.score}/100)` : ""}
- Level to watch: ${t ? `**${fmt(t.resistance)}** overhead / **${fmt(t.support)}** below` : "—"}
- Trigger: ${t ? (t.score > 0 ? `close above **${fmt(t.resistance)}** on rising volume` : `reclaim of **${fmt(t.sma20)}** (20-period mean)`) : "—"}

## 🧭 Regime Read
Watchlist breadth is **${(breadth * 100).toFixed(0)}% green** across ${assets.length} tracked assets → **${regime}**. ${regime === "risk-on" ? "Participation is broad; trend-continuation setups have the edge." : regime === "risk-off" ? "Distribution is broad; fade strength and cut size until breadth repairs." : "Leadership is narrow — favour relative strength over index-level bets."}

## 📊 Technical Read — ${symbol}
${t ? `- **RSI(14):** ${t.rsi.toFixed(1)} → ${t.rsi > 70 ? "overbought, chase risk" : t.rsi < 30 ? "oversold, mean-reversion window" : "neutral zone"}
- **MACD:** line ${fmt(t.macd.macd)} vs signal ${fmt(t.macd.signal)}, histogram **${fmt(t.macd.hist)}** (${t.macd.hist >= 0 ? "bullish cross regime" : "bearish cross regime"})
- **ATR(14):** ${fmt(t.atr)} = ${t.atrPct.toFixed(2)}% of price → position size for a ${(t.atrPct * 1.5).toFixed(2)}% stop
- **MA stack:** 20 ${fmt(t.sma20)} / 50 ${fmt(t.sma50)}${t.sma200 ? ` / 200 ${fmt(t.sma200)}` : ""} — price is ${t.price > t.sma20 ? "above" : "below"} the 20 and ${t.price > t.sma50 ? "above" : "below"} the 50
- **Structure:** ${t.structure}` : "Not enough candle history loaded for indicator computation."}

## 🚀 Top Movers & Why
${leaders.map((a, i) => `${i + 1}. **${a.symbol}** ${a.changePercent >= 0 ? "+" : ""}${a.changePercent.toFixed(2)}% — ${a.changePercent > 5 ? "impulsive expansion, momentum leader" : a.changePercent > 0 ? "quiet relative strength" : "least-weak in a soft tape"}`).join("\n") || "—"}

## 📈 Trend & Path Prediction — ${symbol}
${t ? `- Structure: **${t.structure}**
- Support **${fmt(t.support)}** / Resistance **${fmt(t.resistance)}**
- Short-term (1–5d): bull target **${fmt(t.targets.bull)}**, base **${fmt(t.targets.base)}**, bear **${fmt(t.targets.bear)}**
- Probability: bull **${t.probabilities.bull}%** / base **${t.probabilities.base}%** / bear **${t.probabilities.bear}%**` : "—"}

## ⚔️ Strongest vs Weakest
Leading: ${leaders.map((a) => `**${a.symbol}**`).join(", ") || "—"} · Lagging: ${laggards.map((a) => `**${a.symbol}**`).join(", ") || "—"}. Rotate risk toward leaders while breadth holds.

## 💡 3 Actionable Ideas
${t ? `1. **Continuation** — entry ${fmt(t.sma20)}–${fmt(t.price)}, invalidation ${fmt(t.support)}, first target ${fmt(t.resistance)}; trigger: hourly close above ${fmt(t.resistance)}.
2. **Mean reversion** — only if RSI < 35; entry near ${fmt(t.support)}, stop ${fmt(t.support - t.atr)}, target ${fmt(t.sma20)}.
3. **Relative strength rotation** — long ${leaders[0]?.symbol ?? symbol} vs ${laggards[0]?.symbol ?? "the laggard"}; invalidation is a breadth flip below 35%.` : "Load candles to generate level-based ideas."}

## ⚠️ Risks & What Would Flip the Thesis
${t ? `- Loss of **${fmt(t.support)}** on expanding range flips structure to ${t.score > 0 ? "downtrend" : "capitulation"}.
- ATR is ${t.atrPct.toFixed(2)}% — a volatility contraction below ${(t.atrPct / 2).toFixed(2)}% removes the edge from breakout entries.
- Breadth flipping through ${(breadth * 100).toFixed(0)}% → ${regime === "risk-on" ? "below 35%" : "above 65%"} invalidates the regime call.` : "- Insufficient data; treat all reads as provisional."}`;
}

export type LocalScan = {
  regime: string;
  headline: string;
  trending: Array<{ symbol: string; kind: string; thesis: string; signal: string; confidence: number }>;
  avoid: Array<{ symbol: string; kind: string; reason: string }>;
  ideas: Array<{ title: string; action: string; entry: string; invalidation: string }>;
};

export function localScan(input: {
  pulse: { spy?: { changePercent?: number } | null; btc?: { changePercent?: number } | null };
  cryptoMovers: { gainers: Array<{ symbol: string; changePercent: number; volume?: number }>; losers: Array<{ symbol: string; changePercent: number }> };
  stockMovers: { gainers: Array<{ symbol: string; changePercent: number }>; losers: Array<{ symbol: string; changePercent: number }> };
}): LocalScan {
  const spy = input.pulse.spy?.changePercent ?? 0;
  const btc = input.pulse.btc?.changePercent ?? 0;
  const regime = spy > 0.3 && btc > 0.5 ? "risk-on" : spy < -0.3 && btc < -0.5 ? "risk-off" : "mixed";

  const cg = input.cryptoMovers.gainers ?? [];
  const sg = input.stockMovers.gainers ?? [];
  const cl = input.cryptoMovers.losers ?? [];
  const sl = input.stockMovers.losers ?? [];

  const pool = [
    ...sg.map((g) => ({ symbol: g.symbol, kind: "stock", chg: g.changePercent })),
    ...cg.map((g) => ({ symbol: g.symbol.replace("USDT", ""), kind: "crypto", chg: g.changePercent })),
  ].sort((a, b) => b.chg - a.chg);

  const trending = pool.slice(0, 5).map((p) => ({
    symbol: p.symbol,
    kind: p.kind,
    thesis: p.chg > 12 ? "vertical expansion, late-stage momentum" : p.chg > 5 ? "clean momentum leg with follow-through" : "quiet relative strength building",
    signal: p.chg > 12 ? "breakout" : p.chg > 4 ? "momentum" : "accumulation",
    confidence: p.chg > 12 ? 3 : p.chg > 5 ? 4 : 3,
  }));

  const weak = [
    ...sl.map((g) => ({ symbol: g.symbol, kind: "stock", chg: g.changePercent })),
    ...cl.map((g) => ({ symbol: g.symbol.replace("USDT", ""), kind: "crypto", chg: g.changePercent })),
  ].sort((a, b) => a.chg - b.chg);

  const avoid = weak.slice(0, 3).map((p) => ({
    symbol: p.symbol,
    kind: p.kind,
    reason: p.chg < -12 ? "heavy distribution, knife-catch risk" : "persistent relative weakness",
  }));

  const lead = trending[0]?.symbol ?? "—";
  const lag = avoid[0]?.symbol ?? "—";

  return {
    regime,
    headline: `${regime === "risk-on" ? "Broad bid" : regime === "risk-off" ? "Risk being shed" : "Two-way tape"} — SPY ${spy.toFixed(2)}%, BTC ${btc.toFixed(2)}%; leadership in ${lead}.`,
    trending,
    avoid,
    ideas: [
      { title: `Momentum continuation on ${lead}`, action: "long", entry: "pullback into the prior breakout shelf", invalidation: "loss of the breakout level on closing basis" },
      { title: `Pair rotation ${lead} vs ${lag}`, action: "long", entry: "equal-notional long/short at open", invalidation: "spread reverts beyond entry" },
      { title: regime === "risk-off" ? "Reduce gross, hold cash" : "Add on breadth confirmation", action: "watch", entry: "size up only when breadth >65%", invalidation: "breadth drops under 35%" },
    ],
  };
}

export function localOnchainThesis(t: {
  symbol?: string; name?: string; chain?: string; price?: number;
  priceChange24h?: number; liquidityUsd?: number; volume24h?: number; fdv?: number; createdAt?: number;
}, quality: { score: number; risk: number; label: string; flags: string[]; positives: string[] }): string {
  const liq = t.liquidityUsd ?? 0, vol = t.volume24h ?? 0;
  const ageDays = t.createdAt ? (Date.now() - t.createdAt) / 86_400_000 : 0;
  const ch = t.priceChange24h ?? 0;
  const turnover = liq > 0 ? vol / liq : 0;
  const px = t.price ?? 0;
  return `_Alpha Brain Local Engine — deterministic onchain read (no external model)._

## Thesis
**${t.symbol ?? "Token"}** on **${t.chain ?? "?"}** trades at ${fmt(px)} (${ch >= 0 ? "+" : ""}${ch.toFixed(2)}% 24h) with $${Math.round(liq).toLocaleString()} liquidity and $${Math.round(vol).toLocaleString()} of 24h volume — turnover of ${turnover.toFixed(2)}x. Pair age is ${ageDays.toFixed(1)}d, and the quality engine rates it **${quality.label}** (${quality.score}/100, risk ${quality.risk}). ${quality.positives[0] ? `Supportive: ${quality.positives.join("; ")}.` : ""}

## Path Prediction
- **Bull (24–72h):** reclaim + hold above ${fmt(px * 1.15)} (+15%) requires turnover to stay above ${Math.max(0.5, turnover).toFixed(2)}x
- **Base:** chop between ${fmt(px * 0.9)} and ${fmt(px * 1.1)}
- **Bear:** liquidity drain below $${Math.round(liq * 0.7).toLocaleString()} opens ${fmt(px * 0.6)}
- **Invalidation:** ${fmt(px * 0.82)}

## Trade Plan
- Entry zone ${fmt(px * 0.95)}–${fmt(px)} · first target ${fmt(px * 1.25)} · stop ${fmt(px * 0.82)}
- Max size: keep notional under ${(liq * 0.005).toFixed(0)} USD (0.5% of pool) to limit slippage

## Red Flags
${(quality.flags.length ? quality.flags.slice(0, 4) : ["no structural red flags detected in available metrics"]).map((f) => `- ${f}`).join("\n")}`;
}
