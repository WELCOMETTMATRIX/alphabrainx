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
  chain: string; chainLabel?: string; address: string; name: string; symbol: string; icon?: string;
  price?: number; priceChange24h?: number; priceChangeH1?: number; priceChangeH6?: number;
  liquidityUsd?: number; volume24h?: number; volumeH1?: number;
  fdv?: number; marketCap?: number; pairAddress?: string; dex?: string; pairUrl?: string;
  createdAt?: number; buys24h?: number; sells24h?: number; pairCount?: number;
  explorerUrl?: string;
  quality?: QualityReport;
};

function pickBestPair(pairs: DsPair[]): DsPair | undefined {
  if (!pairs?.length) return undefined;
  return [...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
}

function pairToToken(p: DsPair, pairCount = 1): TokenLite {
  const base: TokenLite = {
    chain: p.chainId,
    chainLabel: chainLabel(p.chainId),
    address: p.baseToken.address,
    name: p.baseToken.name,
    symbol: p.baseToken.symbol,
    icon: p.info?.imageUrl,
    price: p.priceUsd ? parseFloat(p.priceUsd) : undefined,
    priceChange24h: p.priceChange?.h24,
    priceChangeH1: p.priceChange?.h1,
    priceChangeH6: p.priceChange?.h6,
    liquidityUsd: p.liquidity?.usd,
    volume24h: p.volume?.h24,
    volumeH1: p.volume?.h1,
    fdv: p.fdv,
    marketCap: p.marketCap,
    pairAddress: p.pairAddress,
    dex: p.dexId,
    pairUrl: p.url,
    createdAt: p.pairCreatedAt,
    buys24h: p.txns?.h24?.buys,
    sells24h: p.txns?.h24?.sells,
    pairCount,
    explorerUrl: explorerTokenUrl(p.chainId, p.baseToken.address),
  };
  base.quality = scoreToken({
    ...base,
    hasWebsite: !!p.info?.websites?.length,
    hasSocials: !!p.info?.socials?.length,
  });
  return base;
}

/** Apply quality gate + sorting + pagination in one place. */
function refine<T extends TokenLite>(
  tokens: T[],
  opts: { page?: number; pageSize?: number; minScore?: number; includeRisky?: boolean; chain?: string; sort?: "liquidity" | "volume" | "change" | "quality" | "new" } = {},
) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(4, opts.pageSize ?? 24));
  let rows = tokens;
  if (opts.chain) rows = rows.filter((t) => t.chain === opts.chain);
  if (!opts.includeRisky) rows = rows.filter((t) => !t.quality?.filtered);
  if (opts.minScore) rows = rows.filter((t) => (t.quality?.score ?? 0) >= opts.minScore!);
  const sort = opts.sort ?? "liquidity";
  rows = [...rows].sort((a, b) => {
    switch (sort) {
      case "volume": return (b.volume24h ?? 0) - (a.volume24h ?? 0);
      case "change": return (b.priceChange24h ?? 0) - (a.priceChange24h ?? 0);
      case "quality": return (b.quality?.score ?? 0) - (a.quality?.score ?? 0);
      case "new": return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      default: return (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0);
    }
  });
  const total = rows.length;
  const start = (page - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
}

type ListOpts = { page?: number; pageSize?: number; chain?: string; minScore?: number; includeRisky?: boolean; sort?: "liquidity" | "volume" | "change" | "quality" | "new" };

// ---- Search across every chain ----
export const searchOnchain = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string } & ListOpts) => d)
  .handler(async ({ data }) => {
    if (!data.query || data.query.trim().length < 2) return [] as TokenLite[];
    const r = await jget(`${DS}/latest/dex/search?q=${encodeURIComponent(data.query.slice(0, 64))}`, 10_000);
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
      if (best) tokens.push(pairToToken(best, arr.length));
    }
    // Backwards compatible: existing UI consumes a plain array.
    return refine(tokens, { ...data, pageSize: data.pageSize ?? 40, includeRisky: data.includeRisky ?? true }).items;
  });

/** Paginated search (new API) — same data, with total/hasMore for infinite lists. */
export const searchOnchainPaged = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string } & ListOpts) => d)
  .handler(async ({ data }) => {
    const items = await searchOnchain({ data: { ...data, pageSize: 200, page: 1 } });
    return refine(items as TokenLite[], data);
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
// Batched to keep memory + upstream pressure low; deduped + cached upstream.
async function hydrateOnchainList(
  raw: Array<{ chainId: string; tokenAddress: string; icon?: string; description?: string }>,
  limit: number,
): Promise<(TokenLite & { description?: string })[]> {
  const arr = raw.slice(0, limit);
  const out: (TokenLite & { description?: string })[] = [];
  const BATCH = 8;
  for (let i = 0; i < arr.length; i += BATCH) {
    const chunk = arr.slice(i, i + BATCH);
    const results = await Promise.all(chunk.map(async (b) => {
      try {
        const r = await jget(`${DS}/latest/dex/tokens/${b.tokenAddress}`, 30_000);
        const pairs = ((r?.pairs ?? []) as DsPair[]).filter((p) => p.chainId === b.chainId);
        const best = pickBestPair(pairs);
        return best
          ? { ...pairToToken(best, pairs.length), icon: b.icon ?? best.info?.imageUrl, description: b.description }
          : null;
      } catch { return null; }
    }));
    for (const r of results) if (r) out.push(r);
  }
  return out;
}

async function collectTrendingRaw(): Promise<any[]> {
  const [latest, top] = await Promise.all([
    jget(`${DS}/token-boosts/latest/v1`, 60_000).catch(() => []),
    jget(`${DS}/token-boosts/top/v1`, 60_000).catch(() => []),
  ]);
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
  return merged;
}

// ---- Trending (DexScreener boosts, with fallback to top-boosts + new profiles) ----
export const getOnchainTrending = createServerFn({ method: "GET" })
  .inputValidator((d: ListOpts | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const merged = await collectTrendingRaw();
    let out = await hydrateOnchainList(merged, 40);
    if (!out.length) {
      // Absolute fallback: try new-profile listings so the tab is never empty.
      const profiles = await jget(`${DS}/token-profiles/latest/v1`, 60_000).catch(() => [] as any[]);
      out = await hydrateOnchainList(Array.isArray(profiles) ? profiles : [], 40);
    }
    const refined = refine(out, { ...data, pageSize: data.pageSize ?? 28, sort: data.sort ?? "quality" });
    // Never return an empty screen: if the quality gate wipes everything, fall back to raw list.
    return (refined.items.length ? refined.items : out.slice(0, 28)) as TokenLite[];
  });

/** Paginated trending with quality gate + totals. */
export const getOnchainTrendingPaged = createServerFn({ method: "GET" })
  .inputValidator((d: ListOpts | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const merged = await collectTrendingRaw();
    const out = await hydrateOnchainList(merged, 60);
    return refine(out, data);
  });

// ---- New token profiles (latest listings, with fallback to boosts) ----
export const getOnchainNew = createServerFn({ method: "GET" })
  .inputValidator((d: ListOpts | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const list = await jget(`${DS}/token-profiles/latest/v1`, 60_000).catch(() => [] as any[]);
    let out = await hydrateOnchainList(Array.isArray(list) ? list : [], 40);
    if (!out.length) {
      const boosts = await jget(`${DS}/token-boosts/latest/v1`, 60_000).catch(() => [] as any[]);
      out = await hydrateOnchainList(Array.isArray(boosts) ? boosts : [], 40);
    }
    const refined = refine(out, { ...data, pageSize: data.pageSize ?? 28, sort: data.sort ?? "new", includeRisky: data.includeRisky ?? true });
    return (refined.items.length ? refined.items : out.slice(0, 28)) as (TokenLite & { description?: string })[];
  });

/** Automatic cross-chain token detection: top pools per network via GeckoTerminal. */
export const discoverOnchainTokens = createServerFn({ method: "GET" })
  .inputValidator((d: { chains?: string[]; page?: number; pageSize?: number; minScore?: number } | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const chains = (data.chains?.length ? data.chains : ["ethereum", "solana", "base", "bsc", "arbitrum"]).slice(0, 6);
    const perChain = await Promise.all(chains.map(async (c) => {
      const net = gtNetwork(c);
      const r = await jgetAny([
        `${GT}/networks/${net}/trending_pools?page=1`,
        `${GT}/networks/${net}/pools?page=1`,
      ], 60_000).catch(() => null);
      const rows = (r?.data ?? []) as Array<{ attributes: any }>;
      return rows.slice(0, 12).map((p) => {
        const a = p.attributes ?? {};
        const [name] = String(a.name ?? "").split("/");
        const token: TokenLite = {
          chain: c,
          chainLabel: chainLabel(c),
          address: String(a.address ?? ""),
          name: String(a.name ?? name ?? "").trim(),
          symbol: String(name ?? "").trim(),
          price: parseFloat(a.base_token_price_usd ?? "0") || undefined,
          priceChange24h: parseFloat(a.price_change_percentage?.h24 ?? "0") || 0,
          priceChangeH1: parseFloat(a.price_change_percentage?.h1 ?? "0") || 0,
          liquidityUsd: parseFloat(a.reserve_in_usd ?? "0") || 0,
          volume24h: parseFloat(a.volume_usd?.h24 ?? "0") || 0,
          fdv: parseFloat(a.fdv_usd ?? "0") || undefined,
          marketCap: parseFloat(a.market_cap_usd ?? "0") || undefined,
          pairAddress: String(a.address ?? ""),
          createdAt: a.pool_created_at ? Date.parse(a.pool_created_at) : undefined,
          buys24h: a.transactions?.h24?.buys,
          sells24h: a.transactions?.h24?.sells,
        };
        token.quality = scoreToken(token);
        return token;
      });
    }));
    return refine(perChain.flat(), { page: data.page, pageSize: data.pageSize ?? 30, minScore: data.minScore, sort: "quality" });
  });

/** Standalone quality/scam report for one token. */
export const getTokenQuality = createServerFn({ method: "GET" })
  .inputValidator((d: { address: string; chain?: string }) => d)
  .handler(async ({ data }) => {
    const r = await jget(`${DS}/latest/dex/tokens/${data.address}`, 20_000).catch(() => null);
    let pairs = ((r?.pairs ?? []) as DsPair[]);
    if (data.chain) pairs = pairs.filter((p) => p.chainId === data.chain);
    const best = pickBestPair(pairs);
    if (!best) return null;
    const token = pairToToken(best, pairs.length);
    return { token, quality: token.quality! };
  });

// ---- OHLCV candles for a pool ----
export const getOnchainCandles = createServerFn({ method: "GET" })
  .inputValidator((d: { chain: string; poolAddress: string; timeframe?: "minute" | "hour" | "day"; aggregate?: number; limit?: number }) => d)
  .handler(async ({ data }) => {
    const net = gtNetwork(data.chain);
    const tf = data.timeframe ?? "hour";
    const agg = data.aggregate ?? 1;
    const limit = Math.min(data.limit ?? 200, 1000);
    const base = `${GT}/networks/${net}/pools/${data.poolAddress}/ohlcv`;
    const r = await jgetAny([
      `${base}/${tf}?aggregate=${agg}&limit=${limit}&currency=usd`,
      `${base}/${tf}?aggregate=${agg}&limit=${limit}`,
      `${base}/hour?aggregate=1&limit=${limit}&currency=usd`,
    ], 20_000).catch(() => null);
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
    const net = gtNetwork(data.chain);
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

    // ---- Deterministic quality/scam engine (shared with list filtering) ----
    const tx = data.txns24h;
    const quality = scoreToken({
      ...t,
      buys24h: tx?.buys ?? t.buys24h,
      sells24h: tx?.sells ?? t.sells24h,
    });
    const liq = t.liquidityUsd ?? 0;
    const vol = t.volume24h ?? 0;
    const ageDays = t.createdAt ? (Date.now() - t.createdAt) / 86_400_000 : 0;
    const risk = quality.risk;
    const label = quality.label;
    const reasons = quality.flags;

    // ---- Thesis: AI when available, deterministic Local Engine otherwise ----
    const localThesis = () => localOnchainThesis(t, quality);
    const key = process.env.LOVABLE_API_KEY;
    let thesis = "";
    let engine: "ai" | "local" = "local";
    if (key) {
      const gateway = createLovableAiGatewayProvider(key);
      const pc = data.priceChange ?? {};
      const prompt = `You are Alpha Brain — an elite onchain analyst. Output concise markdown, no fluff.
Token: **${t.symbol}** (${t.name}) on **${chainLabel(t.chain)}**
Price: $${t.price}  |  24h: ${t.priceChange24h?.toFixed(2)}%  |  1h: ${pc.h1 ?? "?"}%  |  6h: ${pc.h6 ?? "?"}%
Liquidity: $${Math.round(liq).toLocaleString()}  |  Vol24h: $${Math.round(vol).toLocaleString()}  |  FDV: $${t.fdv ? Math.round(t.fdv).toLocaleString() : "?"}
Pair age: ${ageDays.toFixed(1)}d  |  24h buys/sells: ${tx?.buys ?? t.buys24h ?? "?"} / ${tx?.sells ?? t.sells24h ?? "?"}  |  pairs: ${t.pairCount ?? "?"}
Quality engine: score ${quality.score}/100, risk ${risk}/100 (${label}) — flags: ${reasons.join("; ") || "none"}; positives: ${quality.positives.join("; ") || "none"}

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
        engine = "ai";
      } catch {
        thesis = localThesis();
      }
    } else {
      thesis = localThesis();
    }
    return { risk, riskLabel: label, reasons, thesis, engine, quality };
  });
