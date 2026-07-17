import { createHmac } from "crypto";

const CDCX_PRIVATE = "https://api.crypto.com/exchange/v1/private";

// Deterministic param serializer required by Crypto.com signing spec.
function serialize(obj: unknown): string {
  if (obj == null) return "";
  if (Array.isArray(obj)) return obj.map(serialize).join("");
  if (typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    return Object.keys(o)
      .sort()
      .map((k) => k + serialize(o[k]))
      .join("");
  }
  return String(obj);
}

export type CdcxPrivateOptions = {
  method: string; // e.g. "private/user-balance"
  params?: Record<string, unknown>;
};

export async function cdcxPrivate<T = unknown>({ method, params = {} }: CdcxPrivateOptions): Promise<T> {
  const apiKey = process.env.CRYPTO_COM_API_KEY;
  const apiSecret = process.env.CRYPTO_COM_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error("Missing CRYPTO_COM_API_KEY/CRYPTO_COM_API_SECRET");

  const id = Date.now();
  const nonce = Date.now();
  const sigPayload = `${method}${id}${apiKey}${serialize(params)}${nonce}`;
  const sig = createHmac("sha256", apiSecret).update(sigPayload).digest("hex");

  const body = { id, method, api_key: apiKey, params, nonce, sig };
  const path = method.replace(/^private\//, "");
  const res = await fetch(`${CDCX_PRIVATE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Crypto.com private ${method} ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { code: number; message?: string; result?: T };
  if (json.code !== 0) throw new Error(`Crypto.com ${method} code ${json.code}: ${json.message ?? "unknown"}`);
  return (json.result ?? ({} as T)) as T;
}