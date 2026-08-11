// Deterministic token quality + scam-detection engine.
// Pure functions, zero network / zero AI credits — safe on server and client.

export type QualityInput = {
  chain?: string;
  symbol?: string;
  name?: string;
  price?: number;
  priceChange24h?: number;
  priceChangeH1?: number;
  priceChangeH6?: number;
  liquidityUsd?: number;
  volume24h?: number;
  volumeH1?: number;
  fdv?: number;
  marketCap?: number;
  createdAt?: number;
  buys24h?: number;
  sells24h?: number;
  pairCount?: number;
  hasSocials?: boolean;
  hasWebsite?: boolean;
};

export type QualityReport = {
  /** 0-100, higher = more trustworthy */
  score: number;
  /** 0-100, higher = riskier (inverse-ish of score, computed independently) */
  risk: number;
  label: "trusted" | "solid" | "caution" | "high-risk" | "suspicious";
  /** 0-1 confidence that the metrics themselves are meaningful */
  confidence: number;
  flags: string[];
  positives: string[];
  /** true when the token should be hidden from default listings */
  filtered: boolean;
};

const HONEYPOT_SELL_RATIO = 0.08; // <8% of trades are sells => likely un-sellable
const SCAMMY_NAME = /(elon|free|airdrop|giveaway|x1000|1000x|pump|safu|inu ?killer|test ?token|claim)/i;

function clamp(n: number, lo = 0, hi = 100) {
  return Math.min(hi, Math.max(lo, n));
}

export function scoreToken(t: QualityInput): QualityReport {
  const flags: string[] = [];
  const positives: string[] = [];

  const liq = t.liquidityUsd ?? 0;
  const vol = t.volume24h ?? 0;
  const buys = t.buys24h ?? 0;
  const sells = t.sells24h ?? 0;
  const trades = buys + sells;
  const ageDays = t.createdAt ? (Date.now() - t.createdAt) / 86_400_000 : undefined;
  const fdv = t.fdv ?? t.marketCap ?? 0;

  let risk = 0;

  // ---- Liquidity depth ----
  if (liq <= 0) { risk += 60; flags.push("no measurable liquidity"); }
  else if (liq < 2_000) { risk += 45; flags.push("dust liquidity (<$2k)"); }
  else if (liq < 10_000) { risk += 32; flags.push("very low liquidity (<$10k)"); }
  else if (liq < 50_000) { risk += 20; flags.push("thin liquidity (<$50k)"); }
  else if (liq < 250_000) { risk += 8; }
  else { positives.push(`deep liquidity ($${Math.round(liq).toLocaleString()})`); }

  // ---- Pair age ----
  if (ageDays !== undefined) {
    if (ageDays < 0.25) { risk += 28; flags.push("pair <6h old"); }
    else if (ageDays < 1) { risk += 20; flags.push("pair <24h old"); }
    else if (ageDays < 7) { risk += 10; flags.push("pair <1 week old"); }
    else if (ageDays > 180) { positives.push(`${Math.round(ageDays / 30)}mo track record`); }
  }

  // ---- Wash-trading / volume sanity ----
  if (liq > 0 && vol > 0) {
    const ratio = vol / liq;
    if (ratio > 40) { risk += 22; flags.push(`volume/liquidity ${ratio.toFixed(0)}x — wash-trade pattern`); }
    else if (ratio > 12) { risk += 12; flags.push(`elevated volume/liquidity (${ratio.toFixed(1)}x)`); }
    else if (ratio > 0.3) { positives.push("healthy turnover vs liquidity"); }
  }
  if (vol <= 0) { risk += 18; flags.push("no 24h volume"); }

  // ---- Honeypot heuristic (buys with almost no sells) ----
  if (trades >= 25) {
    const sellShare = sells / trades;
    if (sellShare < HONEYPOT_SELL_RATIO) {
      risk += 30;
      flags.push(`only ${(sellShare * 100).toFixed(1)}% sells — possible honeypot / sell tax`);
    } else if (sellShare > 0.35 && sellShare < 0.65) {
      positives.push("balanced buy/sell flow");
    }
  } else if (trades > 0 && trades < 20) {
    risk += 12; flags.push("very few 24h trades");
  } else if (trades === 0) {
    risk += 16; flags.push("no trade activity in 24h");
  }

  // ---- Valuation vs liquidity ----
  if (fdv > 0 && liq > 0) {
    const fdvRatio = fdv / liq;
    if (fdvRatio > 1000) { risk += 20; flags.push("FDV >1000x liquidity — exit liquidity risk"); }
    else if (fdvRatio > 250) { risk += 10; flags.push("FDV far above liquidity"); }
    else if (fdvRatio < 40) { positives.push("FDV supported by liquidity"); }
  }

  // ---- Volatility spike ----
  const ch24 = t.priceChange24h ?? 0;
  if (Math.abs(ch24) > 300) { risk += 14; flags.push(`extreme 24h move (${ch24.toFixed(0)}%)`); }
  if ((t.priceChangeH1 ?? 0) < -45) { risk += 12; flags.push("sharp 1h drawdown — possible rug in progress"); }

  // ---- Metadata signals ----
  if (SCAMMY_NAME.test(`${t.name ?? ""} ${t.symbol ?? ""}`)) {
    risk += 10; flags.push("scam-adjacent naming pattern");
  }
  if (t.hasWebsite || t.hasSocials) positives.push("public website / socials");
  if ((t.pairCount ?? 0) >= 3) positives.push(`listed on ${t.pairCount} pools`);

  risk = clamp(risk);
  const score = clamp(100 - risk);

  // Confidence in the assessment itself: more data points = more confident.
  let signals = 0;
  if (liq > 0) signals++;
  if (vol > 0) signals++;
  if (trades > 0) signals++;
  if (ageDays !== undefined) signals++;
  if (fdv > 0) signals++;
  const confidence = Math.round((signals / 5) * 100) / 100;

  const label: QualityReport["label"] =
    risk >= 75 ? "suspicious"
      : risk >= 55 ? "high-risk"
        : risk >= 35 ? "caution"
          : risk >= 18 ? "solid"
            : "trusted";

  // Hard filter: unusable or near-certain scam.
  const filtered =
    liq < 1_000 ||
    vol <= 0 && liq < 25_000 ||
    risk >= 82;

  return { score, risk, label, confidence, flags, positives, filtered };
}

/** Filter + rank a token list by quality, keeping only legitimate-looking entries. */
export function filterLegitimate<T extends QualityInput>(
  tokens: T[],
  opts: { minScore?: number; includeFiltered?: boolean } = {},
): Array<T & { quality: QualityReport }> {
  const minScore = opts.minScore ?? 0;
  return tokens
    .map((t) => ({ ...t, quality: scoreToken(t) }))
    .filter((t) => (opts.includeFiltered ? true : !t.quality.filtered) && t.quality.score >= minScore);
}
