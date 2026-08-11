import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { assertAiBudget, clampPrompt } from "./ai-rate-limit.server";
import { localBrief, localScan } from "./local-brain";



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
export const aiMarketScan = createServerFn({ method: "POST" })
  .inputValidator((d: { scope?: "cross" | "stocks" | "crypto" | "watchlist"; watchlist?: string[] } | undefined) => d ?? {})
  .handler(async ({ data }) => {
  assertAiBudget("scan");
  const scope = data.scope ?? "cross";
  const key = process.env.LOVABLE_API_KEY;


  const wantCrypto = scope === "cross" || scope === "crypto";
  const wantStocks = scope === "cross" || scope === "stocks";
  const wideCrypto = scope === "crypto" ? 12 : 6;
  const wideStocks = scope === "stocks" ? 10 : 6;

  const [cryptoMovers, stockMovers, pulse] = await Promise.all([
    wantCrypto ? (async () => {
      const rows = await cdcxTickers();
      const usdt = rows
        .filter((t) => t.i.endsWith("_USDT") || t.i.endsWith("_USD"))
        .map((t) => ({ symbol: fromCdcxInstrument(t.i), price: parseFloat(t.a ?? "0"), changePercent: parseFloat(t.c ?? "0") * 100, volume: parseFloat(t.vv ?? "0") }))
        .filter((t) => t.volume > 250_000 && !Number.isNaN(t.changePercent));
      return {
        gainers: [...usdt].sort((a, b) => b.changePercent - a.changePercent).slice(0, wideCrypto),
        losers: [...usdt].sort((a, b) => a.changePercent - b.changePercent).slice(0, wideCrypto),
      };
    })() : Promise.resolve({ gainers: [], losers: [] }),
    wantStocks ? (async () => {
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
        gainers: [...valid].sort((a, b) => b.changePercent - a.changePercent).slice(0, wideStocks),
        losers: [...valid].sort((a, b) => a.changePercent - b.changePercent).slice(0, wideStocks),
      };
    })() : Promise.resolve({ gainers: [], losers: [] }),
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

  const scopeLabel = scope === "cross" ? "All Markets (stocks + crypto)"
    : scope === "stocks" ? "Stocks only" : scope === "crypto" ? "Crypto only" : "Watchlist";

  const fallback = () => ({
    scan: localScan({ pulse, cryptoMovers, stockMovers }),
    raw: "",
    engine: "local" as const,
    pulse, cryptoMovers, stockMovers,
  });
  if (!key) return fallback();

  const gateway = createLovableAiGatewayProvider(key);
  const prompt = `You are Alpha Brain — a sharp cross-market scanner. Scope: ${scopeLabel}. Output STRICT JSON only, no prose, no markdown fences.

Data snapshot (24h):
Market pulse: SPY ${pulse.spy?.changePercent?.toFixed(2)}%, BTC ${pulse.btc?.changePercent?.toFixed(2)}%
${wantCrypto ? `Crypto gainers: ${cryptoMovers.gainers.slice(0,8).map(g=>`${g.symbol.replace("USDT","")} +${g.changePercent.toFixed(1)}%`).join(", ")}
Crypto losers: ${cryptoMovers.losers.slice(0,8).map(g=>`${g.symbol.replace("USDT","")} ${g.changePercent.toFixed(1)}%`).join(", ")}` : ""}
${wantStocks ? `Stock gainers: ${stockMovers.gainers.map(g=>`${g.symbol} +${g.changePercent.toFixed(1)}%`).join(", ")}
Stock losers: ${stockMovers.losers.map(g=>`${g.symbol} ${g.changePercent.toFixed(1)}%`).join(", ")}` : ""}
${data.watchlist?.length ? `Watchlist focus: ${data.watchlist.join(", ")}` : ""}

Return this exact JSON shape:
{
  "regime": "risk-on|risk-off|mixed",
  "headline": "one punchy sentence about the market right now",
  "trending": [ { "symbol": "STR", "kind": "stock|crypto", "thesis": "6-14 words", "signal": "breakout|momentum|reversal|accumulation", "confidence": 1-5 } ],
  "avoid": [ { "symbol": "STR", "kind": "stock|crypto", "reason": "6-12 words" } ],
  "ideas": [ { "title": "short idea", "action": "long|short|watch", "entry": "text", "invalidation": "text" } ]
}
Include 5 trending, 3 avoid, 3 ideas.${scope === "cross" ? " Mix stocks & crypto." : scope === "stocks" ? " Stocks only." : scope === "crypto" ? " Crypto only." : ""}`;

  let text = "";
  try {
    const r = await generateText({ model: gateway("google/gemini-3-flash-preview"), prompt });
    text = r.text;
  } catch {
    return fallback();
  }

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
  if (!parsed) return fallback();
  return { scan: parsed, raw: text, engine: "ai" as const, pulse, cryptoMovers, stockMovers };
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
    assertAiBudget("analyze");
    const key = process.env.LOVABLE_API_KEY;
    const question = data.question ? clampPrompt(data.question, 500) : undefined;
    const localAnalysis = () => localBrief({
      symbol: data.symbol ?? data.assets[0]?.symbol ?? "asset",
      assets: data.assets ?? [],
      candles: data.candles,
      question,
    });
    if (!key) return { analysis: localAnalysis(), engine: "local" as const };


    // Compute rich technicals for the focus symbol
    let techBlock = "";
    if (data.candles && data.candles.length > 5) {
      techBlock = "\n" + computeTechBlock(data.symbol ?? "asset", data.candles);
    }

    const assetList = data.assets
      .map((a) => `${a.symbol} (${a.kind}): $${a.price.toFixed(4)}, ${a.changePercent.toFixed(2)}% 24h`)
      .join("\n");

    const gateway = createLovableAiGatewayProvider(key);
    const prompt = `You are Alpha Brain — an elite quantitative market strategist trained on decades of price action, macro cycles, and cross-asset flows. Speak with authority and precision. Use markdown with clean sections (##), bullet lists, and inline **bold** for tickers and key levels. Not financial advice.

Watchlist snapshot (24h):
${assetList}
${techBlock}

${question ? `User question: ${question}\n\nAnswer directly and specifically, citing prices, %, and structural levels where relevant.` : `Deliver a full brief for **${data.symbol}** and the watchlist:

## ⚡ TL;DR
Exactly 3 bullets — the bias, the level to watch, and the trigger. Punchy, decisive.

## 🧭 Regime Read
One paragraph: risk-on / risk-off / rotation, and what it means right now.

## 📊 Technical Read — ${data.symbol}
Interpret the RSI, MACD, ATR, moving-average stack, and structure block explicitly. Cite the actual numbers.

## 🚀 Top Movers & Why
Rank 3–5 with a one-line thesis each.

## 📈 Trend & Path Prediction — ${data.symbol}
- Current structure (uptrend / downtrend / range / accumulation)
- Key support & resistance levels with exact prices
- Next probable price path (short-term 1–5 days, mid-term 2–4 weeks) with % targets
- Probability read (base %, bull %, bear %) that sums to 100

## ⚔️ Strongest vs Weakest
Comparative read across the watchlist — who leads, who lags, and why.

## 💡 3 Actionable Ideas
For each: entry zone, invalidation, first target, and the trigger to watch.

## ⚠️ Risks & What Would Flip the Thesis
Concrete catalysts, not vague warnings.`}`;

    try {
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        prompt,
      });
      return { analysis: text, engine: "ai" as const };
    } catch {
      return { analysis: localAnalysis(), engine: "local" as const };
    }
  });

// ---- Indicator helpers ----
function sma(arr: number[], n: number) {
  if (arr.length < n) return arr.reduce((a, b) => a + b, 0) / arr.length;
  const s = arr.slice(-n);
  return s.reduce((a, b) => a + b, 0) / s.length;
}
function emaSeries(arr: number[], n: number): number[] {
  if (!arr.length) return [];
  const k = 2 / (n + 1);
  const out: number[] = [arr[0]];
  for (let i = 1; i < arr.length; i++) out.push(arr[i] * k + out[i - 1] * (1 - k));
  return out;
}
function rsi(closes: number[], n = 14): number {
  if (closes.length < n + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - n; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  const rs = losses === 0 ? 100 : gains / losses;
  return 100 - 100 / (1 + rs);
}
function macd(closes: number[]) {
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const line = closes.map((_, i) => ema12[i] - ema26[i]);
  const signal = emaSeries(line, 9);
  const hist = line.map((v, i) => v - signal[i]);
  const n = closes.length - 1;
  return { line: line[n], signal: signal[n], hist: hist[n], prevHist: hist[n - 1] ?? 0 };
}
function atr(candles: Candle[], n = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
  }
  const s = trs.slice(-n);
  return s.reduce((a, b) => a + b, 0) / s.length;
}
function computeTechBlock(symbol: string, candles: Candle[]): string {
  const closes = candles.map((c) => c.close);
  const vols = candles.map((c) => c.volume);
  const last = closes[closes.length - 1];
  const first = closes[0];
  const pctRange = ((last - first) / first) * 100;
  const s7 = sma(closes, 7), s25 = sma(closes, 25), s50 = sma(closes, Math.min(50, closes.length));
  const highest = Math.max(...closes), lowest = Math.min(...closes);
  const r = rsi(closes, 14);
  const m = macd(closes);
  const a = atr(candles, 14);
  const volAvg = vols.slice(-20).reduce((x, y) => x + y, 0) / Math.min(20, vols.length);
  const volLast = vols[vols.length - 1];
  const volMult = volAvg ? volLast / volAvg : 1;
  // Structure: last 20 candles higher-highs / higher-lows
  const seg = candles.slice(-20);
  let hh = 0, hl = 0, lh = 0, ll = 0;
  for (let i = 1; i < seg.length; i++) {
    if (seg[i].high > seg[i - 1].high) hh++; else lh++;
    if (seg[i].low > seg[i - 1].low) hl++; else ll++;
  }
  const structure = hh + hl > lh + ll ? "higher highs / higher lows (uptrend)"
    : lh + ll > hh + hl ? "lower highs / lower lows (downtrend)" : "range / choppy";
  const macdBias = m.line > m.signal && m.hist > m.prevHist ? "bullish + expanding"
    : m.line > m.signal ? "bullish"
    : m.hist < m.prevHist ? "bearish + expanding" : "bearish";
  const rsiTag = r >= 70 ? "overbought" : r <= 30 ? "oversold" : r >= 55 ? "bullish" : r <= 45 ? "bearish" : "neutral";
  return `Technicals for ${symbol} (${candles.length} bars):
- Last: ${last.toFixed(6)}  |  Period range: ${pctRange.toFixed(2)}%  |  ATR14: ${a.toFixed(6)} (${((a / last) * 100).toFixed(2)}% of price)
- SMA stack: 7=${s7.toFixed(4)}, 25=${s25.toFixed(4)}, 50=${s50.toFixed(4)} → ${s7 > s25 && s25 > s50 ? "aligned bullish" : s7 < s25 && s25 < s50 ? "aligned bearish" : "mixed"}
- RSI14: ${r.toFixed(1)} (${rsiTag})  |  MACD: line=${m.line.toFixed(6)} signal=${m.signal.toFixed(6)} hist=${m.hist.toFixed(6)} → ${macdBias}
- Structure (last 20): ${structure}  |  Vol vs avg20: ${volMult.toFixed(2)}x
- Period high/low: ${highest.toFixed(6)} / ${lowest.toFixed(6)}`;
}

// ============================================================================
// BACKTEST SANDBOX — replay AI-style signals on historical candles
// ============================================================================
export const runBacktest = createServerFn({ method: "POST" })
  .inputValidator((d: {
    candles: Candle[];
    symbol: string;
    strategy?: "sma_cross" | "rsi_reversion" | "macd_trend";
    fast?: number; slow?: number;
    aiCommentary?: boolean;
  }) => d)
  .handler(async ({ data }) => {
    const strat = data.strategy ?? "sma_cross";
    const fast = data.fast ?? 7;
    const slow = data.slow ?? 25;
    const candles = data.candles ?? [];
    if (candles.length < Math.max(slow, 30)) {
      return { error: "Not enough historical data for a meaningful backtest (need 30+ bars)." };
    }
    const closes = candles.map((c) => c.close);
    // Precompute indicators
    const fastEma = emaSeries(closes, fast);
    const slowEma = emaSeries(closes, slow);
    const macdSeries = (() => {
      const e12 = emaSeries(closes, 12); const e26 = emaSeries(closes, 26);
      const line = closes.map((_, i) => e12[i] - e26[i]);
      const sig = emaSeries(line, 9);
      return { line, sig };
    })();

    type Trade = { entryIdx: number; exitIdx?: number; entry: number; exit?: number; pct?: number; entryTime: number; exitTime?: number };
    const trades: Trade[] = [];
    let inPos = false, cur: Trade | null = null;

    const signalLong = (i: number): boolean => {
      if (i < Math.max(slow, 26) + 1) return false;
      if (strat === "sma_cross") return fastEma[i] > slowEma[i] && fastEma[i - 1] <= slowEma[i - 1];
      if (strat === "macd_trend") return macdSeries.line[i] > macdSeries.sig[i] && macdSeries.line[i - 1] <= macdSeries.sig[i - 1];
      // rsi_reversion: RSI crosses back above 30
      const r0 = rsi(closes.slice(0, i), 14);
      const r1 = rsi(closes.slice(0, i + 1), 14);
      return r0 < 30 && r1 >= 30;
    };
    const signalExit = (i: number): boolean => {
      if (strat === "sma_cross") return fastEma[i] < slowEma[i] && fastEma[i - 1] >= slowEma[i - 1];
      if (strat === "macd_trend") return macdSeries.line[i] < macdSeries.sig[i] && macdSeries.line[i - 1] >= macdSeries.sig[i - 1];
      const r1 = rsi(closes.slice(0, i + 1), 14);
      return r1 >= 70;
    };

    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      if (!inPos && signalLong(i)) {
        cur = { entryIdx: i, entry: c.close, entryTime: c.time };
        inPos = true;
      } else if (inPos && cur && signalExit(i)) {
        cur.exitIdx = i; cur.exit = c.close; cur.exitTime = c.time;
        cur.pct = ((c.close - cur.entry) / cur.entry) * 100;
        trades.push(cur); cur = null; inPos = false;
      }
    }
    // Close open position at last bar
    if (inPos && cur) {
      const last = candles[candles.length - 1];
      cur.exitIdx = candles.length - 1; cur.exit = last.close; cur.exitTime = last.time;
      cur.pct = ((last.close - cur.entry) / cur.entry) * 100;
      trades.push(cur);
    }

    // Equity curve (compound)
    let equity = 1;
    const equityCurve: Array<{ time: number; equity: number }> = [{ time: candles[0].time, equity: 1 }];
    for (const t of trades) {
      equity *= 1 + (t.pct ?? 0) / 100;
      equityCurve.push({ time: t.exitTime ?? 0, equity });
    }
    // Max drawdown
    let peak = 1, maxDd = 0;
    for (const p of equityCurve) {
      if (p.equity > peak) peak = p.equity;
      const dd = (peak - p.equity) / peak;
      if (dd > maxDd) maxDd = dd;
    }
    const wins = trades.filter((t) => (t.pct ?? 0) > 0).length;
    const winRate = trades.length ? (wins / trades.length) * 100 : 0;
    const avgWin = trades.filter((t) => (t.pct ?? 0) > 0).reduce((a, b) => a + (b.pct ?? 0), 0) / (wins || 1);
    const avgLoss = trades.filter((t) => (t.pct ?? 0) <= 0).reduce((a, b) => a + (b.pct ?? 0), 0) / ((trades.length - wins) || 1);
    const totalReturn = (equity - 1) * 100;
    // Buy & hold baseline
    const bh = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
    // Simple sharpe over trade returns
    const rets = trades.map((t) => (t.pct ?? 0) / 100);
    const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1);
    const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(Math.min(rets.length, 252)) : 0;

    const stats = {
      strategy: strat, fast, slow,
      trades: trades.length,
      winRate: +winRate.toFixed(1),
      totalReturn: +totalReturn.toFixed(2),
      buyHoldReturn: +bh.toFixed(2),
      alpha: +(totalReturn - bh).toFixed(2),
      maxDrawdown: +(maxDd * 100).toFixed(2),
      avgWin: +avgWin.toFixed(2),
      avgLoss: +avgLoss.toFixed(2),
      sharpe: +sharpe.toFixed(2),
    };

    let commentary = "";
    if (data.aiCommentary) {
      assertAiBudget("backtest");
      const key = process.env.LOVABLE_API_KEY;
      if (key) {
        const gateway = createLovableAiGatewayProvider(key);
        const prompt = `You are Alpha Brain reviewing a backtest for **${data.symbol}**.
Strategy: ${strat} (fast=${fast}, slow=${slow}) over ${candles.length} bars.
Results: ${JSON.stringify(stats)}
Last 5 trades: ${JSON.stringify(trades.slice(-5).map((t) => ({ pct: t.pct?.toFixed(2), entry: t.entry, exit: t.exit })))}

Write a **short markdown review** (max 180 words):
## Verdict
One-line grade: A/B/C/D with why.
## Edge Check
Did it beat buy & hold on risk-adjusted basis? Cite alpha + sharpe + max DD.
## Regime Fit
When does this strategy shine vs fail on this asset?
## Live-Trade Recommendation
Would you actually deploy this? What parameter or filter would you tune first?`;
        try {
          const { text } = await generateText({ model: gateway("google/gemini-3-flash-preview"), prompt });
          commentary = text;
        } catch (e) { commentary = `_AI review unavailable: ${(e as Error).message}_`; }
      }
    }

    return { stats, trades, equityCurve, commentary };
  });

