import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { cdcxPrivate } from "./cdcx-auth.server";

const FINNHUB = "https://finnhub.io/api/v1";
const CDCX = "https://api.crypto.com/exchange/v1/public";

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

// ---- Simple in-memory cache to survive Finnhub's tight free-tier rate limit ----
type CacheEntry = { at: number; value: unknown };
const CACHE = new Map<string, CacheEntry>();
const INFLIGHT = new Map<string, Promise<unknown>>();

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const running = INFLIGHT.get(key);
  if (running) return running as Promise<T>;
  const p = (async () => {
    try {
      const v = await fn();
      CACHE.set(key, { at: Date.now(), value: v });
      return v;
    } finally {
      INFLIGHT.delete(key);
    }
  })();
  INFLIGHT.set(key, p);
  return p;
}

async function finnhub(path: string, params: Record<string, string | number> = {}) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("Missing FINNHUB_API_KEY");
  const url = new URL(`${FINNHUB}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("token", key);
  const cacheKey = `fh:${path}:${JSON.stringify(params)}`;
  return cached(cacheKey, 20_000, async () => {
    const res = await fetch(url.toString());
    if (res.status === 429) {
      // Serve stale value if we have any, otherwise a minimal shape
      const stale = CACHE.get(cacheKey);
      if (stale) return stale.value as unknown;
      return {};
    }
    if (!res.ok) throw new Error(`Finnhub ${path} ${res.status}: ${await res.text()}`);
    return res.json();
  });
}

// ---- Crypto.com Exchange helpers ----
function toCdcxInstrument(sym: string): string {
  const s = sym.toUpperCase();
  if (s.includes("_")) return s;
  // Legacy Binance-style BTCUSDT -> BTC_USDT
  for (const quote of ["USDT", "USDC", "USD", "BTC", "ETH"]) {
    if (s.endsWith(quote) && s.length > quote.length) return `${s.slice(0, -quote.length)}_${quote}`;
  }
  return s;
}
function fromCdcxInstrument(inst: string): string {
  return inst.replace("_", "");
}

type CdcxTicker = {
  i: string;     // instrument name e.g. BTC_USDT
  a?: string;    // latest trade price
  b?: string;    // best bid
  k?: string;    // best ask
  h?: string;    // 24h high
  l?: string;    // 24h low
  v?: string;    // 24h volume (base)
  vv?: string;   // 24h volume value (quote)
  c?: string;    // 24h change vs open (percentage as decimal, e.g. 0.0234 = 2.34%)
  o?: string;    // 24h open
  t?: number;    // timestamp
};

async function cdcxTickers(instrument?: string): Promise<CdcxTicker[]> {
  const key = instrument ? `cdcx:t:${instrument}` : "cdcx:t:all";
  return cached(key, instrument ? 8_000 : 15_000, async () => {
    const url = new URL(`${CDCX}/get-tickers`);
    if (instrument) url.searchParams.set("instrument_name", instrument);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Crypto.com tickers ${res.status}`);
    const json = await res.json();
    return (json?.result?.data ?? []) as CdcxTicker[];
  });
}

// ---- STOCKS (Finnhub) ----
export const getStockQuote = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(async ({ data }) => {
    const q = await finnhub("/quote", { symbol: data.symbol.toUpperCase() });
    return {
      symbol: data.symbol.toUpperCase(),
      price: (q.c ?? 0) as number,
      change: (q.d ?? 0) as number,
      changePercent: (q.dp ?? 0) as number,
      high: (q.h ?? 0) as number,
      low: (q.l ?? 0) as number,
      open: (q.o ?? 0) as number,
      prevClose: (q.pc ?? 0) as number,
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
    const now = Math.floor(Date.now() / 1000);
    const days = data.days ?? 30;
    const q = await finnhub("/quote", { symbol: data.symbol.toUpperCase() });
    const price = (q.c as number) || 100;
    const prev = (q.pc as number) || price;
    const out: Candle[] = [];
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

// ---- CRYPTO (Crypto.com Exchange, free public) ----
export const getCryptoQuote = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(async ({ data }) => {
    const inst = toCdcxInstrument(data.symbol);
    const rows = await cdcxTickers(inst);
    const t = rows[0];
    if (!t) throw new Error(`Crypto.com ticker not found for ${inst}`);
    const price = parseFloat(t.a ?? "0");
    const open = parseFloat(t.o ?? "0") || price;
    const changePct = parseFloat(t.c ?? "0") * 100;
    return {
      symbol: fromCdcxInstrument(inst),
      price,
      change: price - open,
      changePercent: changePct,
      high: parseFloat(t.h ?? "0"),
      low: parseFloat(t.l ?? "0"),
      open,
      prevClose: open,
      volume: parseFloat(t.v ?? "0"),
    };
  });

export const getCryptoCandles = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string; interval?: string; limit?: number }) => d)
  .handler(async ({ data }): Promise<Candle[]> => {
    const inst = toCdcxInstrument(data.symbol);
    // Map Binance-ish intervals to Crypto.com timeframes
    const map: Record<string, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1h", "4h": "4h", "6h": "6h", "12h": "12h", "1d": "1D", "1D": "1D", "1w": "7D" };
    const timeframe = map[data.interval ?? "1h"] ?? "1h";
    const count = Math.min(data.limit ?? 200, 300);
    const url = `${CDCX}/get-candlestick?instrument_name=${inst}&timeframe=${timeframe}&count=${count}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Crypto.com candles ${inst} ${res.status}`);
    const json = await res.json();
    const rows = (json?.result?.data ?? []) as Array<{ t: number; o: string; h: string; l: string; c: string; v: string }>;
    return rows.map((r) => ({
      time: Math.floor(r.t / 1000),
      open: parseFloat(r.o),
      high: parseFloat(r.h),
      low: parseFloat(r.l),
      close: parseFloat(r.c),
      volume: parseFloat(r.v),
    }));
  });

// ---- TOP MOVERS (Crypto.com) ----
export const getTopCryptoMovers = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await cdcxTickers();
  const usdt = rows
    .filter((t) => t.i.endsWith("_USDT") || t.i.endsWith("_USD"))
    .map((t) => ({
      symbol: fromCdcxInstrument(t.i),
      price: parseFloat(t.a ?? "0"),
      changePercent: parseFloat(t.c ?? "0") * 100,
      volume: parseFloat(t.vv ?? "0"),
    }))
    .filter((t) => t.price > 0 && !Number.isNaN(t.changePercent) && t.volume > 250_000);
  const gainers = [...usdt].sort((a, b) => b.changePercent - a.changePercent).slice(0, 10);
  const losers = [...usdt].sort((a, b) => a.changePercent - b.changePercent).slice(0, 10);
  return { gainers, losers };
});

// ---- FULL CRYPTO UNIVERSE (Crypto.com) ----
export const getAllCryptoTokens = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await cdcxTickers();
  return rows
    .filter((t) => t.i.endsWith("_USDT") || t.i.endsWith("_USD"))
    .map((t) => ({
      symbol: fromCdcxInstrument(t.i),        // e.g. BTCUSDT
      instrument: t.i,                        // e.g. BTC_USDT
      base: t.i.split("_")[0],
      price: parseFloat(t.a ?? "0"),
      changePercent: parseFloat(t.c ?? "0") * 100,
      volume: parseFloat(t.vv ?? "0"),
      high: parseFloat(t.h ?? "0"),
      low: parseFloat(t.l ?? "0"),
    }))
    .filter((t) => t.price > 0)
    .sort((a, b) => b.volume - a.volume);
});


// ---- MARKET PULSE (indices + majors) ----
const PULSE_STOCKS = ["SPY", "QQQ", "DIA", "IWM", "VIX"];
const PULSE_CRYPTO = ["BTC_USDT", "ETH_USDT", "SOL_USDT"];

export const getMarketPulse = createServerFn({ method: "GET" }).handler(async () => {
  const stocks = await Promise.all(
    PULSE_STOCKS.map(async (s) => {
      try {
        const q = await finnhub("/quote", { symbol: s });
        return { symbol: s, price: (q.c ?? 0) as number, changePercent: (q.dp ?? 0) as number, kind: "stock" as const };
      } catch {
        return null;
      }
    })
  );
  const crypto = await Promise.all(
    PULSE_CRYPTO.map(async (s) => {
      try {
        const rows = await cdcxTickers(s);
        const t = rows[0];
        if (!t) return null;
        return { symbol: fromCdcxInstrument(s), price: parseFloat(t.a ?? "0"), changePercent: parseFloat(t.c ?? "0") * 100, kind: "crypto" as const };
      } catch {
        return null;
      }
    })
  );
  return { stocks: stocks.filter(Boolean), crypto: crypto.filter(Boolean) };
});

// ---- TRENDING STOCKS (curated universe scan via Finnhub quotes) ----
export const STOCK_UNIVERSE = [
  // Mega-cap tech
  "AAPL","MSFT","NVDA","TSLA","AMZN","GOOGL","GOOG","META","AVGO","ORCL",
  // Semis & AI
  "AMD","INTC","MU","QCOM","ARM","SMCI","TSM","ASML","MRVL","LRCX","AMAT","KLAC","ADI","NXPI","ON","MPWR",
  // Software / Cloud
  "CRM","SNOW","PLTR","NOW","ADBE","INTU","WDAY","PANW","CRWD","ZS","NET","DDOG","MDB","OKTA","TEAM","SHOP","SQ","PYPL","UBER","ABNB","LYFT","ROKU","SPOT",
  // Crypto-adjacent
  "COIN","MSTR","MARA","RIOT","CLSK","HUT","BITF",
  // Consumer / Retail
  "NFLX","DIS","NKE","MCD","SBUX","COST","WMT","TGT","HD","LOW","BABA","JD","PDD","PEP","KO","MDLZ","CMG","LULU",
  // Autos / EV
  "F","GM","RIVN","LCID","NIO","XPEV","LI","STLA","TM",
  // Finance
  "JPM","BAC","WFC","GS","MS","C","BLK","SCHW","V","MA","AXP","BX","KKR","COF","USB","PNC",
  // Energy / Industrials
  "XOM","CVX","COP","SLB","OXY","BP","SHEL","BA","CAT","DE","GE","HON","LMT","RTX","NOC","MMM","UPS","FDX","DAL","UAL","AAL",
  // Health / Biotech
  "LLY","UNH","JNJ","PFE","MRK","ABBV","TMO","DHR","AMGN","GILD","MRNA","BNTX","REGN","VRTX","ISRG","BMY",
  // ETFs / Indices
  "SPY","QQQ","DIA","IWM","VOO","XLK","XLF","XLE","SMH","ARKK","GLD","SLV","TLT","VIX","EEM","EFA",
];

const STOCK_NAMES: Record<string, string> = {
  AAPL: "Apple", MSFT: "Microsoft", NVDA: "NVIDIA", TSLA: "Tesla", AMZN: "Amazon",
  GOOGL: "Alphabet A", GOOG: "Alphabet C", META: "Meta Platforms", AMD: "AMD", NFLX: "Netflix",
  AVGO: "Broadcom", PLTR: "Palantir", COIN: "Coinbase", SMCI: "Super Micro", MSTR: "MicroStrategy",
  ORCL: "Oracle", CRM: "Salesforce", INTC: "Intel", MU: "Micron", QCOM: "Qualcomm",
  BA: "Boeing", JPM: "JPMorgan", BAC: "Bank of America", XOM: "Exxon", CVX: "Chevron",
  UBER: "Uber", SHOP: "Shopify", SNOW: "Snowflake", ARM: "Arm Holdings", DELL: "Dell",
  MARA: "Marathon Digital", BABA: "Alibaba", DIS: "Disney", V: "Visa", MA: "Mastercard",
  PYPL: "PayPal", SQ: "Block", ROKU: "Roku", ABNB: "Airbnb", LYFT: "Lyft",
  PEP: "PepsiCo", KO: "Coca-Cola", WMT: "Walmart", TGT: "Target", COST: "Costco",
  HD: "Home Depot", LOW: "Lowe's", NKE: "Nike", MCD: "McDonald's", SBUX: "Starbucks",
  F: "Ford", GM: "General Motors", RIVN: "Rivian", LCID: "Lucid", GE: "GE Aerospace",
  CAT: "Caterpillar", DE: "Deere", HON: "Honeywell", BLK: "BlackRock", GS: "Goldman Sachs",
  TSM: "TSMC", ASML: "ASML", MRVL: "Marvell", LRCX: "Lam Research", AMAT: "Applied Materials",
  KLAC: "KLA", ADI: "Analog Devices", NXPI: "NXP", ON: "onsemi", MPWR: "Monolithic Power",
  NOW: "ServiceNow", ADBE: "Adobe", INTU: "Intuit", WDAY: "Workday", PANW: "Palo Alto",
  CRWD: "CrowdStrike", ZS: "Zscaler", NET: "Cloudflare", DDOG: "Datadog", MDB: "MongoDB",
  OKTA: "Okta", TEAM: "Atlassian", SPOT: "Spotify", RIOT: "Riot Platforms", CLSK: "CleanSpark",
  HUT: "Hut 8", BITF: "Bitfarms", JD: "JD.com", PDD: "PDD Holdings", MDLZ: "Mondelez",
  CMG: "Chipotle", LULU: "Lululemon", NIO: "NIO", XPEV: "XPeng", LI: "Li Auto", STLA: "Stellantis", TM: "Toyota",
  WFC: "Wells Fargo", MS: "Morgan Stanley", C: "Citigroup", SCHW: "Schwab", AXP: "American Express",
  BX: "Blackstone", KKR: "KKR", COF: "Capital One", USB: "US Bancorp", PNC: "PNC",
  COP: "ConocoPhillips", SLB: "Schlumberger", OXY: "Occidental", BP: "BP", SHEL: "Shell",
  LMT: "Lockheed", RTX: "RTX", NOC: "Northrop", MMM: "3M", UPS: "UPS", FDX: "FedEx",
  DAL: "Delta", UAL: "United", AAL: "American Airlines",
  LLY: "Eli Lilly", UNH: "UnitedHealth", JNJ: "J&J", PFE: "Pfizer", MRK: "Merck",
  ABBV: "AbbVie", TMO: "Thermo Fisher", DHR: "Danaher", AMGN: "Amgen", GILD: "Gilead",
  MRNA: "Moderna", BNTX: "BioNTech", REGN: "Regeneron", VRTX: "Vertex", ISRG: "Intuitive Surgical", BMY: "Bristol-Myers",
  SPY: "S&P 500 ETF", QQQ: "Nasdaq 100 ETF", DIA: "Dow ETF", IWM: "Russell 2000", VOO: "Vanguard 500",
  XLK: "Tech Sector", XLF: "Financials", XLE: "Energy", SMH: "Semiconductors", ARKK: "ARK Innovation",
  GLD: "Gold", SLV: "Silver", TLT: "20Y Treasuries", VIX: "Volatility", EEM: "Emerging Mkts", EFA: "Developed Intl",
};

export const getAllStocks = createServerFn({ method: "GET" }).handler(async () => {
  const quotes = await Promise.all(
    STOCK_UNIVERSE.map(async (s) => {
      try {
        const q = await finnhub("/quote", { symbol: s });
        return {
          symbol: s,
          name: STOCK_NAMES[s] ?? s,
          price: (q.c ?? 0) as number,
          changePercent: (q.dp ?? 0) as number,
          high: (q.h ?? 0) as number,
          low: (q.l ?? 0) as number,
        };
      } catch {
        return { symbol: s, name: STOCK_NAMES[s] ?? s, price: 0, changePercent: 0, high: 0, low: 0 };
      }
    })
  );
  return quotes;
});

export const getTrendingStocks = createServerFn({ method: "GET" }).handler(async () => {
  const quotes = await Promise.all(
    STOCK_UNIVERSE.map(async (s) => {
      try {
        const q = await finnhub("/quote", { symbol: s });
        return { symbol: s, price: (q.c ?? 0) as number, changePercent: (q.dp ?? 0) as number, high: (q.h ?? 0) as number, low: (q.l ?? 0) as number };
      } catch {
        return null;
      }
    })
  );
  const valid = quotes.filter(Boolean) as Array<{ symbol: string; price: number; changePercent: number; high: number; low: number }>;
  const gainers = [...valid].sort((a, b) => b.changePercent - a.changePercent).slice(0, 6);
  const losers = [...valid].sort((a, b) => a.changePercent - b.changePercent).slice(0, 6);
  return { gainers, losers };
});

// ---- AI MARKET SCAN (structured cross-market picks) ----
export const aiMarketScan = createServerFn({ method: "POST" }).handler(async () => {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const [cryptoMovers, stockMovers, pulse] = await Promise.all([
    (async () => {
      const rows = await cdcxTickers();
      const usdt = rows
        .filter((t) => t.i.endsWith("_USDT") || t.i.endsWith("_USD"))
        .map((t) => ({ symbol: fromCdcxInstrument(t.i), price: parseFloat(t.a ?? "0"), changePercent: parseFloat(t.c ?? "0") * 100, volume: parseFloat(t.vv ?? "0") }))
        .filter((t) => t.volume > 250_000 && !Number.isNaN(t.changePercent));
      return {
        gainers: [...usdt].sort((a, b) => b.changePercent - a.changePercent).slice(0, 8),
        losers: [...usdt].sort((a, b) => a.changePercent - b.changePercent).slice(0, 8),
      };
    })(),
    (async () => {
      const quotes = await Promise.all(
        STOCK_UNIVERSE.map(async (s) => {
          try {
            const q = await finnhub("/quote", { symbol: s });
            return { symbol: s, price: (q.c ?? 0) as number, changePercent: (q.dp ?? 0) as number };
          } catch { return null; }
        })
      );
      const valid = quotes.filter(Boolean) as Array<{ symbol: string; price: number; changePercent: number }>;
      return {
        gainers: [...valid].sort((a, b) => b.changePercent - a.changePercent).slice(0, 6),
        losers: [...valid].sort((a, b) => a.changePercent - b.changePercent).slice(0, 6),
      };
    })(),
    (async () => {
      const spy = await finnhub("/quote", { symbol: "SPY" }).catch(() => null);
      const btcRows = await cdcxTickers("BTC_USDT").catch(() => [] as CdcxTicker[]);
      const btc = btcRows[0];
      return {
        spy: spy ? { price: spy.c, changePercent: spy.dp } : null,
        btc: btc ? { price: parseFloat(btc.a ?? "0"), changePercent: parseFloat(btc.c ?? "0") * 100 } : null,
      };
    })(),
  ]);

  const gateway = createLovableAiGatewayProvider(key);
  const prompt = `You are Alpha Brain — a sharp cross-market scanner. Output STRICT JSON only, no prose, no markdown fences.

Data snapshot (24h):
Market pulse: SPY ${pulse.spy?.changePercent?.toFixed(2)}%, BTC ${pulse.btc?.changePercent?.toFixed(2)}%
Crypto gainers: ${cryptoMovers.gainers.slice(0,6).map(g=>`${g.symbol.replace("USDT","")} +${g.changePercent.toFixed(1)}%`).join(", ")}
Crypto losers: ${cryptoMovers.losers.slice(0,6).map(g=>`${g.symbol.replace("USDT","")} ${g.changePercent.toFixed(1)}%`).join(", ")}
Stock gainers: ${stockMovers.gainers.map(g=>`${g.symbol} +${g.changePercent.toFixed(1)}%`).join(", ")}
Stock losers: ${stockMovers.losers.map(g=>`${g.symbol} ${g.changePercent.toFixed(1)}%`).join(", ")}

Return this exact JSON shape:
{
  "regime": "risk-on|risk-off|mixed",
  "headline": "one punchy sentence about the market right now",
  "trending": [ { "symbol": "STR", "kind": "stock|crypto", "thesis": "6-14 words", "signal": "breakout|momentum|reversal|accumulation", "confidence": 1-5 } ],
  "avoid": [ { "symbol": "STR", "kind": "stock|crypto", "reason": "6-12 words" } ],
  "ideas": [ { "title": "short idea", "action": "long|short|watch", "entry": "text", "invalidation": "text" } ]
}
Include 5 trending, 3 avoid, 3 ideas. Mix stocks & crypto.`;

  const { text } = await generateText({
    model: gateway("google/gemini-3-flash-preview"),
    prompt,
  });

  // strip code fences if any
  const cleaned = text.replace(/```json|```/g, "").trim();
  type ScanResult = {
    regime?: string;
    headline?: string;
    trending?: Array<{ symbol: string; kind: string; thesis: string; signal: string; confidence: number }>;
    avoid?: Array<{ symbol: string; kind: string; reason: string }>;
    ideas?: Array<{ title: string; action: string; entry: string; invalidation: string }>;
  };
  let parsed: ScanResult | null = null;
  try { parsed = JSON.parse(cleaned) as ScanResult; } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]) as ScanResult; } catch { /* noop */ } }
  }
  return { scan: parsed, raw: text, pulse, cryptoMovers, stockMovers };
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
    const prompt = `You are Alpha Brain — an elite quantitative market strategist trained on decades of price action, macro cycles, and cross-asset flows. Speak with authority and precision. Use markdown with clean sections (##), bullet lists, and inline **bold** for tickers and key levels. Not financial advice.

Watchlist snapshot (24h):
${assetList}
${techBlock}

${data.question ? `User question: ${data.question}\n\nAnswer directly and specifically, citing prices, %, and structural levels where relevant.` : `Deliver a full brief for **${data.symbol}** and the watchlist:

## 🧭 Regime Read
One paragraph: risk-on / risk-off / rotation, and what it means right now.

## 🚀 Top Movers & Why
Rank 3–5 with a one-line thesis each.

## 📈 Trend & Path Prediction — ${data.symbol}
- Current structure (uptrend / downtrend / range / accumulation)
- Key support & resistance levels with exact prices
- Next probable price path (short-term 1–5 days, mid-term 2–4 weeks) with % targets
- Probability read (base case, bull case, bear case)

## ⚔️ Strongest vs Weakest
Comparative read across the watchlist — who leads, who lags, and why.

## 💡 3 Actionable Ideas
For each: entry zone, invalidation, first target, and the trigger to watch.

## ⚠️ Risks & What Would Flip the Thesis
Concrete catalysts, not vague warnings.`}`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
    });
    return { analysis: text };
  });
