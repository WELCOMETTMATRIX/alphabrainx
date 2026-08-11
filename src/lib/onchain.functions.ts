import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { assertAiBudget } from "./ai-rate-limit.server";
import { gtNetwork, explorerTokenUrl, chainLabel, CHAINS } from "./onchain-chains";
import { scoreToken, type QualityReport } from "./token-quality";
import { localOnchainThesis } from "./local-brain";


// Free, no-key onchain data:
//   DexScreener   → search, token→pairs, trending boosts, new profiles, txn/liquidity/volume
//   GeckoTerminal → OHLCV candles + recent trades per pool, on 100+ networks

const DS = "https://api.dexscreener.com";
const GT = "https://api.geckoterminal.com/api/v2";

// ---- Cache (avoid hammering free endpoints) with stale-on-error + inflight dedup ----
type CacheEntry = { at: number; value: unknown };
const CACHE = new Map<string, CacheEntry>();
const INFLIGHT = new Map<string, Promise<unknown>>();
const STALE_MAX_MS = 10 * 60_000; // serve stale up to 10min on upstream failure

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const pending = INFLIGHT.get(key);
  if (pending) return pending as Promise<T>;
  const p = (async () => {
    try {
      const v = await fn();
      CACHE.set(key, { at: Date.now(), value: v });
      return v;
    } catch (e) {
      // Serve stale value if we have one within STALE_MAX_MS, else rethrow.
      if (hit && Date.now() - hit.at < STALE_MAX_MS) return hit.value as T;
      throw e;
    } finally {
      INFLIGHT.delete(key);
    }
  })();
  INFLIGHT.set(key, p);
  return p;
}

async function jget(url: string, ttlMs = 15_000): Promise<any> {
  return cached(`g:${url}`, ttlMs, async () => {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`${url} ${res.status}`);
    return res.json();
  });

}

// Multi-provider fetch with failover: tries each URL in order, returns first success.
async function jgetAny(urls: string[], ttlMs = 15_000): Promise<any> {
  let lastErr: unknown;
  for (const u of urls) {
    try { return await jget(u, ttlMs); } catch (e) { lastErr = e; }
  }
  throw lastErr ?? new Error("all providers failed");
}

/** Public: list every supported network (for chain filters in the UI). */
export const listOnchainNetworks = createServerFn({ method: "GET" }).handler(async () =>
  CHAINS.map((c) => ({ id: c.id, label: c.label, native: c.native ?? "" })),
);

// -------- DexScreener types (subset) --------
type DsPair = {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative?: string;
  priceUsd?: string;
  txns?: { m5?: { buys: number; sells: number }; h1?: { buys: number; sells: number }; h6?: { buys: number; sells: number }; h24?: { buys: number; sells: number } };
  volume?: { m5?: number; h1?: number; h6?: number; h24?: number };
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string; websites?: Array<{ url: string }>; socials?: Array<{ type: string; url: string }> };
};

type TokenLite = {
  chain: string; address: string; name: string; symbol: string; icon?: string;
  price?: number; priceChange24h?: number; liquidityUsd?: number; volume24h?: number;
  fdv?: number; marketCap?: number; pairAddress?: string; dex?: string; pairUrl?: string;
  createdAt?: number;
};

function pickBestPair(pairs: DsPair[]): DsPair | undefined {
  if (!pairs?.length) return undefined;
  return [...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
}

function pairToToken(p: DsPair): TokenLite {
  return {
    chain: p.chainId,
    address: p.baseToken.address,
    name: p.baseToken.name,
    symbol: p.baseToken.symbol,
    icon: p.info?.imageUrl,
    price: p.priceUsd ? parseFloat(p.priceUsd) : undefined,
    priceChange24h: p.priceChange?.h24,
    liquidityUsd: p.liquidity?.usd,
    volume24h: p.volume?.h24,
    fdv: p.fdv,
    marketCap: p.marketCap,
    pairAddress: p.pairAddress,
    dex: p.dexId,
    pairUrl: p.url,
    createdAt: p.pairCreatedAt,
  };
}

// ---- Search across every chain ----
export const searchOnchain = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }) => {
    if (!data.query || data.query.trim().length < 2) return [] as TokenLite[];
    const r = await jget(`${DS}/latest/dex/search?q=${encodeURIComponent(data.query)}`, 10_000);
    const pairs = (r?.pairs ?? []) as DsPair[];
    // group by base token; pick best pair per token
    const byToken = new Map<string, DsPair[]>();
    for (const p of pairs) {
      const key = `${p.chainId}:${p.baseToken?.address?.toLowerCase()}`;
      if (!key) continue;
      const arr = byToken.get(key) ?? [];
      arr.push(p);
      byToken.set(key, arr);
    }
    const tokens: TokenLite[] = [];
    for (const arr of byToken.values()) {
      const best = pickBestPair(arr);
      if (best) tokens.push(pairToToken(best));
    }
    return tokens
      .filter((t) => (t.liquidityUsd ?? 0) > 500)
      .sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0))
      .slice(0, 40);
  });

// ---- Token by contract address ----
export const getOnchainToken = createServerFn({ method: "GET" })
  .inputValidator((d: { address: string; chain?: string }) => d)
  .handler(async ({ data }) => {
    const r = await jget(`${DS}/latest/dex/tokens/${data.address}`, 10_000);
    let pairs = (r?.pairs ?? []) as DsPair[];
    if (data.chain) pairs = pairs.filter((p) => p.chainId === data.chain);
    const best = pickBestPair(pairs);
    if (!best) return null;
    return {
      token: pairToToken(best),
      allPairs: pairs.map((p) => ({
        chain: p.chainId, dex: p.dexId, pairAddress: p.pairAddress,
        liquidityUsd: p.liquidity?.usd ?? 0, volume24h: p.volume?.h24 ?? 0,
        priceUsd: p.priceUsd ? parseFloat(p.priceUsd) : 0, url: p.url,
        quote: p.quoteToken.symbol,
      })).sort((a, b) => b.liquidityUsd - a.liquidityUsd),
      txns24h: best.txns?.h24,
      priceChange: best.priceChange,
      volume: best.volume,
    };
  });

// Expand a raw list of {chainId, tokenAddress, icon?, description?} entries into hydrated tokens.
async function hydrateOnchainList(
  raw: Array<{ chainId: string; tokenAddress: string; icon?: string; description?: string }>,
  limit: number,
): Promise<(TokenLite & { description?: string })[]> {
  const arr = raw.slice(0, limit);
  const results = await Promise.all(arr.map(async (b) => {
    try {
      const r = await jget(`${DS}/latest/dex/tokens/${b.tokenAddress}`, 30_000);
      const pairs = ((r?.pairs ?? []) as DsPair[]).filter((p) => p.chainId === b.chainId);
      const best = pickBestPair(pairs);
      return best ? { ...pairToToken(best), icon: b.icon ?? best.info?.imageUrl, description: b.description } : null;
    } catch { return null; }
  }));
  return results.filter(Boolean) as (TokenLite & { description?: string })[];
}

// ---- Trending (DexScreener boosts, with fallback to top-boosts + new profiles) ----
export const getOnchainTrending = createServerFn({ method: "GET" }).handler(async () => {
  const sources: Array<Promise<any[]>> = [
    jget(`${DS}/token-boosts/latest/v1`, 60_000).catch(() => []),
    jget(`${DS}/token-boosts/top/v1`, 60_000).catch(() => []),
  ];
  const [latest, top] = await Promise.all(sources);
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const src of [latest, top]) {
    for (const b of Array.isArray(src) ? src : []) {
      const k = `${b.chainId}:${b.tokenAddress}`;
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(b);
    }
  }
  let out = await hydrateOnchainList(merged, 28);
  if (!out.length) {
    // Absolute fallback: try new-profile listings so the tab is never empty.
    const profiles = await jget(`${DS}/token-profiles/latest/v1`, 60_000).catch(() => [] as any[]);
    out = await hydrateOnchainList(Array.isArray(profiles) ? profiles : [], 28);
  }
  return out as TokenLite[];
});

// ---- New token profiles (latest listings, with fallback to boosts) ----
export const getOnchainNew = createServerFn({ method: "GET" }).handler(async () => {
  const list = await jget(`${DS}/token-profiles/latest/v1`, 60_000).catch(() => [] as any[]);
  let out = await hydrateOnchainList(Array.isArray(list) ? list : [], 28);
  if (!out.length) {
    const boosts = await jget(`${DS}/token-boosts/latest/v1`, 60_000).catch(() => [] as any[]);
    out = await hydrateOnchainList(Array.isArray(boosts) ? boosts : [], 28);
  }
  return out as (TokenLite & { description?: string })[];
});


// ---- OHLCV candles for a pool ----
export const getOnchainCandles = createServerFn({ method: "GET" })
  .inputValidator((d: { chain: string; poolAddress: string; timeframe?: "minute" | "hour" | "day"; aggregate?: number; limit?: number }) => d)
  .handler(async ({ data }) => {
    const net = CHAIN_TO_GT[data.chain] ?? data.chain;
    const tf = data.timeframe ?? "hour";
    const agg = data.aggregate ?? 1;
    const limit = Math.min(data.limit ?? 200, 1000);
    const url = `${GT}/networks/${net}/pools/${data.poolAddress}/ohlcv/${tf}?aggregate=${agg}&limit=${limit}&currency=usd`;
    const r = await jget(url, 20_000).catch(() => null);
    const rows = (r?.data?.attributes?.ohlcv_list ?? []) as Array<[number, number, number, number, number, number]>;
    // ohlcv_list is [timestamp, open, high, low, close, volume]
    return rows
      .map((c) => ({ time: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5] }))
      .sort((a, b) => a.time - b.time);
  });

// ---- Recent trades for a pool ----
export const getOnchainTrades = createServerFn({ method: "GET" })
  .inputValidator((d: { chain: string; poolAddress: string }) => d)
  .handler(async ({ data }) => {
    const net = CHAIN_TO_GT[data.chain] ?? data.chain;
    const url = `${GT}/networks/${net}/pools/${data.poolAddress}/trades?trade_volume_in_usd_greater_than=0`;
    const r = await jget(url, 15_000).catch(() => null);
    const rows = (r?.data ?? []) as Array<{ attributes: any }>;
    return rows.slice(0, 40).map((t) => {
      const a = t.attributes;
      return {
        blockTimestamp: a.block_timestamp as string,
        kind: a.kind as "buy" | "sell",
        priceUsd: parseFloat(a.price_to_in_usd ?? a.price_from_in_usd ?? "0"),
        volumeUsd: parseFloat(a.volume_in_usd ?? "0"),
        fromToken: a.from_token_amount as string,
        toToken: a.to_token_amount as string,
        tx: a.tx_hash as string,
      };
    });
  });

// ---- Risk score + AI thesis ----
export const aiOnchainAnalyze = createServerFn({ method: "POST" })
  .inputValidator((d: { token: TokenLite; txns24h?: { buys: number; sells: number }; priceChange?: { h1?: number; h6?: number; h24?: number } }) => d)
  .handler(async ({ data }) => {
    assertAiBudget("onchain");
    const t = data.token;

    // ---- Deterministic risk heuristics (0 safest → 100 riskiest) ----
    let risk = 0;
    const reasons: string[] = [];
    const liq = t.liquidityUsd ?? 0;
    const vol = t.volume24h ?? 0;
    const ageDays = t.createdAt ? (Date.now() - t.createdAt) / 86_400_000 : 0;
    if (liq < 10_000) { risk += 40; reasons.push("very low liquidity (<$10k)"); }
    else if (liq < 50_000) { risk += 25; reasons.push("thin liquidity (<$50k)"); }
    else if (liq < 250_000) { risk += 10; reasons.push("moderate liquidity"); }
    if (ageDays > 0 && ageDays < 1) { risk += 25; reasons.push("<24h old pair"); }
    else if (ageDays < 7) { risk += 12; reasons.push("<1w old pair"); }
    if (vol > 0 && liq > 0 && vol / liq > 10) { risk += 15; reasons.push("volume/liquidity ratio >10 (possible wash)"); }
    if (t.fdv && liq && t.fdv / liq > 500) { risk += 15; reasons.push("FDV >>liquidity"); }
    const tx = data.txns24h;
    if (tx && tx.buys + tx.sells < 20) { risk += 10; reasons.push("very few 24h trades"); }
    risk = Math.min(100, Math.max(0, risk));
    const label = risk >= 70 ? "high" : risk >= 40 ? "medium" : "low";

    // ---- AI thesis ----
    const key = process.env.LOVABLE_API_KEY;
    let thesis = "";
    if (key) {
      const gateway = createLovableAiGatewayProvider(key);
      const pc = data.priceChange ?? {};
      const prompt = `You are Alpha Brain — an elite onchain analyst. Output concise markdown, no fluff.
Token: **${t.symbol}** (${t.name}) on **${t.chain}**
Price: $${t.price}  |  24h: ${t.priceChange24h?.toFixed(2)}%  |  1h: ${pc.h1 ?? "?"}%  |  6h: ${pc.h6 ?? "?"}%
Liquidity: $${Math.round(liq).toLocaleString()}  |  Vol24h: $${Math.round(vol).toLocaleString()}  |  FDV: $${t.fdv ? Math.round(t.fdv).toLocaleString() : "?"}
Pair age: ${ageDays.toFixed(1)}d  |  24h buys/sells: ${tx?.buys ?? "?"} / ${tx?.sells ?? "?"}
Deterministic risk score: ${risk}/100 (${label}) — ${reasons.join("; ") || "no major flags"}

Return:
## Thesis
2–3 sentences: what this token looks like right now (momentum, structure, flow).
## Path Prediction
- Short (24–72h): bull / base / bear with % targets from current price
- Invalidation level (price)
## Trade Plan
- Entry zone, first target, stop
## Red Flags
Bullet the top 2 concrete risks.`;
      try {
        const { text } = await generateText({ model: gateway("google/gemini-3-flash-preview"), prompt });
        thesis = text;
      } catch (e) {
        thesis = `_AI unavailable: ${(e as Error).message}_`;
      }
    }
    return { risk, riskLabel: label, reasons, thesis };
  });
