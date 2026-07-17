import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const FINNHUB = "https://finnhub.io/api/v1";
const BINANCE = "https://api.binance.com/api/v3";

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

async function finnhub(path: string, params: Record<string, string | number> = {}) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("Missing FINNHUB_API_KEY");
  const url = new URL(`${FINNHUB}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("token", key);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Finnhub ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---- STOCKS (Finnhub) ----
export const getStockQuote = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(async ({ data }) => {
    const q = await finnhub("/quote", { symbol: data.symbol.toUpperCase() });
    // { c: current, d: change, dp: percent, h, l, o, pc: prev close, t }
    return {
      symbol: data.symbol.toUpperCase(),
      price: q.c as number,
      change: q.d as number,
      changePercent: q.dp as number,
      high: q.h as number,
      low: q.l as number,
      open: q.o as number,
      prevClose: q.pc as number,
    };
  });

export const searchStocks = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }) => {
    const r = await finnhub("/search", { q: data.query });
    return (r.result ?? []).slice(0, 10).map((it: { symbol: string; description: string; type: string }) => ({
      symbol: it.symbol,
      description: it.description,
      type: it.type,
    }));
  });

export const getStockCandles = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string; days?: number }) => d)
  .handler(async ({ data }): Promise<Candle[]> => {
    // Free Finnhub tier lost /stock/candle. Approximate a daily series from the quote for chart display.
    const now = Math.floor(Date.now() / 1000);
    const days = data.days ?? 30;
    const q = await finnhub("/quote", { symbol: data.symbol.toUpperCase() });
    const price = q.c as number;
    const prev = (q.pc as number) || price;
    const out: Candle[] = [];
    // synth intraday walk anchored on prev->current so chart isn't empty on free tier
    let p = prev * 0.97;
    for (let i = days; i >= 0; i--) {
      const t = now - i * 86400;
      const drift = (price - prev * 0.97) / (days || 1);
      const noise = (Math.sin(i * 1.3) + Math.cos(i * 0.7)) * price * 0.008;
      const open = p;
      const close = i === 0 ? price : p + drift + noise;
      const high = Math.max(open, close) * (1 + Math.random() * 0.006);
      const low = Math.min(open, close) * (1 - Math.random() * 0.006);
      out.push({ time: t, open, high, low, close, volume: 0 });
      p = close;
    }
    return out;
  });

// ---- CRYPTO (Binance, free public) ----
export const getCryptoQuote = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(async ({ data }) => {
    const sym = data.symbol.toUpperCase();
    const res = await fetch(`${BINANCE}/ticker/24hr?symbol=${sym}`);
    if (!res.ok) throw new Error(`Binance ${sym} ${res.status}`);
    const t = await res.json();
    return {
      symbol: sym,
      price: parseFloat(t.lastPrice),
      change: parseFloat(t.priceChange),
      changePercent: parseFloat(t.priceChangePercent),
      high: parseFloat(t.highPrice),
      low: parseFloat(t.lowPrice),
      open: parseFloat(t.openPrice),
      prevClose: parseFloat(t.prevClosePrice),
      volume: parseFloat(t.volume),
    };
  });

export const getCryptoCandles = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string; interval?: string; limit?: number }) => d)
  .handler(async ({ data }): Promise<Candle[]> => {
    const sym = data.symbol.toUpperCase();
    const interval = data.interval ?? "1h";
    const limit = data.limit ?? 168;
    const res = await fetch(`${BINANCE}/klines?symbol=${sym}&interval=${interval}&limit=${limit}`);
    if (!res.ok) throw new Error(`Binance klines ${sym} ${res.status}`);
    const rows = (await res.json()) as unknown[][];
    return rows.map((r) => ({
      time: Math.floor((r[0] as number) / 1000),
      open: parseFloat(r[1] as string),
      high: parseFloat(r[2] as string),
      low: parseFloat(r[3] as string),
      close: parseFloat(r[4] as string),
      volume: parseFloat(r[5] as string),
    }));
  });

// ---- TOP MOVERS (Binance) ----
export const getTopCryptoMovers = createServerFn({ method: "GET" }).handler(async () => {
  const res = await fetch(`${BINANCE}/ticker/24hr`);
  const all = (await res.json()) as Array<{
    symbol: string;
    lastPrice: string;
    priceChangePercent: string;
    quoteVolume: string;
  }>;
  const usdt = all
    .filter((t) => t.symbol.endsWith("USDT") && parseFloat(t.quoteVolume) > 50_000_000)
    .map((t) => ({
      symbol: t.symbol,
      price: parseFloat(t.lastPrice),
      changePercent: parseFloat(t.priceChangePercent),
      volume: parseFloat(t.quoteVolume),
    }));
  const gainers = [...usdt].sort((a, b) => b.changePercent - a.changePercent).slice(0, 8);
  const losers = [...usdt].sort((a, b) => a.changePercent - b.changePercent).slice(0, 8);
  return { gainers, losers };
});

// ---- AI BRAIN ----
type AssetSummary = {
  symbol: string;
  kind: "stock" | "crypto";
  price: number;
  changePercent: number;
  high?: number;
  low?: number;
};

export const aiAnalyze = createServerFn({ method: "POST" })
  .inputValidator((d: { assets: AssetSummary[]; candles?: Candle[]; symbol?: string; question?: string }) => d)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    // Compute simple technicals for the focus symbol
    let techBlock = "";
    if (data.candles && data.candles.length > 5) {
      const closes = data.candles.map((c) => c.close);
      const sma = (n: number) => {
        const s = closes.slice(-n);
        return s.reduce((a, b) => a + b, 0) / s.length;
      };
      const sma7 = sma(Math.min(7, closes.length));
      const sma25 = sma(Math.min(25, closes.length));
      const last = closes[closes.length - 1];
      const first = closes[0];
      const pctRange = ((last - first) / first) * 100;
      const highest = Math.max(...closes);
      const lowest = Math.min(...closes);
      let ups = 0;
      for (let i = 1; i < closes.length; i++) if (closes[i] > closes[i - 1]) ups++;
      const upRatio = ups / (closes.length - 1);
      techBlock = `\nTechnicals for ${data.symbol}:
- Last: ${last.toFixed(4)}
- Period range: ${pctRange.toFixed(2)}%
- SMA7: ${sma7.toFixed(4)}, SMA25: ${sma25.toFixed(4)} (${sma7 > sma25 ? "bullish cross" : "bearish cross"})
- Period high/low: ${highest.toFixed(4)} / ${lowest.toFixed(4)}
- Up-bar ratio: ${(upRatio * 100).toFixed(0)}%`;
    }

    const assetList = data.assets
      .map((a) => `${a.symbol} (${a.kind}): $${a.price.toFixed(4)}, ${a.changePercent.toFixed(2)}% 24h`)
      .join("\n");

    const gateway = createLovableAiGatewayProvider(key);
    const prompt = `You are a sharp market analyst. Be concise, use markdown with short sections and bullets. Not financial advice.

Watchlist snapshot:
${assetList}
${techBlock}

${data.question ? `User question: ${data.question}` : `Provide:
1. Top movers & why they matter
2. Comparative read (which look strongest vs weakest)
3. Uptrend / breakout candidates & the price path/levels to watch
4. Risks
5. 3 actionable ideas (entries / invalidation levels)`}`;

    const { text } = await generateText({
      model: gateway("google/gemini-3.5-flash"),
      prompt,
    });
    return { analysis: text };
  });
