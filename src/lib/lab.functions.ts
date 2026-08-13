import { createServerFn } from "@tanstack/react-start";
import { getAllStocks, getAllCryptoTokens, getStockCandles, getCryptoCandles } from "./market.functions";
import { scoreUniverse, correlationReport, type LabInput } from "./lab.server";

/** Cross-market Edge Board: every tracked stock + crypto scored by the deterministic lab engine. */
export const getEdgeBoard = createServerFn({ method: "GET" })
  .inputValidator((d: { market?: "all" | "stock" | "crypto"; limit?: number } | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const market = data.market ?? "all";
    const limit = Math.min(Math.max(data.limit ?? 40, 5), 120);

    const [stocks, crypto] = await Promise.all([
      market === "crypto" ? Promise.resolve([]) : getAllStocks().catch(() => []),
      market === "stock" ? Promise.resolve([]) : getAllCryptoTokens().catch(() => []),
    ]);

    const stockRows: LabInput[] = (stocks as Array<{ symbol: string; name: string; price: number; changePercent: number; high: number; low: number }>)
      .filter((s) => s.price > 0)
      .map((s) => ({ symbol: s.symbol, name: s.name, kind: "stock", price: s.price, changePercent: s.changePercent, high: s.high, low: s.low, volume: Math.max(s.price, 1) * 1000 }));

    const cryptoRows: LabInput[] = (crypto as Array<{ symbol: string; base: string; price: number; changePercent: number; high: number; low: number; volume: number; confidenceScore?: number; riskScore?: number }>)
      .filter((c) => c.price > 0 && c.volume > 0)
      .map((c) => ({ symbol: c.symbol, name: c.base, kind: "crypto", price: c.price, changePercent: c.changePercent, high: c.high, low: c.low, volume: c.volume, confidenceScore: c.confidenceScore, riskScore: c.riskScore }));

    // Score each class against its own peers, then merge — cross-class z-scores are meaningless.
    const scored = [...scoreUniverse(stockRows), ...scoreUniverse(cryptoRows)].sort((a, b) => b.edge - a.edge);

    const longs = scored.filter((r) => r.edge > 0).slice(0, limit);
    const shorts = [...scored].reverse().filter((r) => r.edge < 0).slice(0, Math.min(limit, 20));
    const breadth = scored.length ? scored.filter((r) => r.edge > 0).length / scored.length : 0;

    return {
      generatedAt: new Date().toISOString(),
      universe: scored.length,
      breadth: Number((breadth * 100).toFixed(1)),
      regime: breadth > 0.62 ? "risk-on" : breadth < 0.38 ? "risk-off" : "rotational",
      longs,
      shorts,
      engine: "local" as const,
    };
  });

/** Correlation + diversification report for up to 8 assets. */
export const getCorrelation = createServerFn({ method: "POST" })
  .inputValidator((d: { assets: Array<{ symbol: string; kind: "stock" | "crypto" }> }) => d)
  .handler(async ({ data }) => {
    const assets = (data.assets ?? []).slice(0, 8);
    if (assets.length < 2) throw new Error("Pick at least two assets to compare.");

    const series = await Promise.all(
      assets.map(async (a) => {
        try {
          const candles = a.kind === "crypto"
            ? await getCryptoCandles({ data: { symbol: a.symbol, interval: "1h", limit: 200 } })
            : await getStockCandles({ data: { symbol: a.symbol, days: 90 } });
          return { symbol: a.symbol, closes: candles.map((c) => c.close).filter((n) => n > 0) };
        } catch {
          return { symbol: a.symbol, closes: [] as number[] };
        }
      }),
    );

    const usable = series.filter((s) => s.closes.length >= 10);
    if (usable.length < 2) throw new Error("Not enough price history for these assets.");
    return correlationReport(usable);
  });
