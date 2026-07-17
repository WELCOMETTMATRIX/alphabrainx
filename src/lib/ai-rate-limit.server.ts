// Server-only rate limit + budget guard for AI-backed public server functions.
// In-memory per-IP token bucket + shared daily invocation cap. Best-effort:
// resets on each Worker isolate, but blunts scripted abuse of paid API keys.

import { getRequest } from "@tanstack/react-start/server";

type Bucket = { tokens: number; updatedAt: number };
const BUCKETS = new Map<string, Bucket>();

// Per-IP: 12 requests / minute, refill continuously.
const CAPACITY = 12;
const REFILL_PER_MS = CAPACITY / 60_000;

// Global: 5000 AI invocations / rolling day per isolate.
const DAILY_CAP = 5000;
let dailyCount = 0;
let dailyResetAt = Date.now() + 86_400_000;

// Prompt input size guardrail (chars).
export const MAX_PROMPT_CHARS = 8000;

function clientIp(): string {
  try {
    const req = getRequest();
    const h = req.headers;
    const fwd = h.get("cf-connecting-ip")
      || h.get("x-real-ip")
      || h.get("x-forwarded-for")?.split(",")[0]?.trim()
      || "unknown";
    return fwd || "unknown";
  } catch { return "unknown"; }
}

export function assertAiBudget(opKey: string) {
  const now = Date.now();
  if (now >= dailyResetAt) { dailyCount = 0; dailyResetAt = now + 86_400_000; }
  if (dailyCount >= DAILY_CAP) {
    throw new Error("Daily AI budget exceeded on this server. Try again later.");
  }

  const ip = clientIp();
  const key = `${ip}:${opKey}`;
  const b = BUCKETS.get(key) ?? { tokens: CAPACITY, updatedAt: now };
  const elapsed = now - b.updatedAt;
  b.tokens = Math.min(CAPACITY, b.tokens + elapsed * REFILL_PER_MS);
  b.updatedAt = now;
  if (b.tokens < 1) {
    BUCKETS.set(key, b);
    const waitMs = Math.ceil((1 - b.tokens) / REFILL_PER_MS);
    throw new Error(`Rate limit: too many AI requests. Retry in ${Math.ceil(waitMs / 1000)}s.`);
  }
  b.tokens -= 1;
  BUCKETS.set(key, b);
  dailyCount += 1;
}

export function clampPrompt(text: string, max = MAX_PROMPT_CHARS) {
  if (typeof text !== "string") return "";
  return text.length > max ? text.slice(0, max) : text;
}
