## Scope

Ship four upgrades on top of the current Obsidian Pro 2026 dashboard, without touching the working AI + market data pipeline behind them.

### 1. Crypto.com API — authenticated setup
- `CRYPTO_COM_API_KEY` / `CRYPTO_COM_API_SECRET` are now saved.
- Add `src/lib/cdcx-auth.server.ts` — HMAC-SHA256 signer for Crypto.com private endpoints (`private/user-balance`, `private/get-open-orders`), following their nonce+params spec.
- Add server fns `getCdcxBalance` / `getCdcxOpenOrders` (auth'd via `requireSupabaseAuth` is not required here since keys are server-only, but gated behind a simple `?` server-side check).
- Public market data keeps using the unauth'd endpoints already wired (no rate-limit hit).
- New "Account" glass card on the right rail shows balances when keys work; shows "Add keys in Settings" hint otherwise. Never expose keys client-side.

### 2. Price Alerts
- New table `price_alerts` (id, user_id, symbol, kind stock|crypto, direction above|below, target numeric, note, active, triggered_at, created_at) + RLS + grants per project rules.
- Server fns: `createAlert`, `listAlerts`, `deleteAlert`, `evaluateAlerts` (compares current quote to targets, marks triggered).
- Client: polls `evaluateAlerts` every 30s while tab is open; fires browser `Notification` + a glass toast when triggered.
- "Alerts" tab in the left navigator with an inline creator (symbol picker + above/below + price).
- AI-scan alerts: a toggle "Notify me when AI scan flags this asset as trending/avoid" — piggybacks on the existing `aiMarketScan` result.

### 3. Compare Mode
- New "Compare" toggle above the chart. Multi-select up to 4 symbols from any list (stock + crypto mixed).
- Normalizes each series to % change from the first candle so they overlay meaningfully.
- Highlights correlation: computes pairwise Pearson correlation of the normalized closes; badges pairs with |r| > 0.7 as "moving together" (green) or "inverse" (red).
- Reuses existing `getStockCandles` / `getCryptoCandles`; no new market endpoints.

### 4. Fast browsers (All Stocks / All Crypto)
- Add `react-window` for virtualization.
- Debounced search (symbol + name), sort by price / %change / volume asc/desc, sticky header, pagination-free virtual scroll.
- Skeleton rows while data loads; row height fixed for smoothness on mobile.

### 5. Liquid-glass iOS theme + full mobile
- Add `.glass` / `.glass-strong` / `.glass-pill` tokens in `src/styles.css` using `backdrop-filter: blur() saturate()` + layered white/color overlays over a deep obsidian gradient background.
- Refactor panels, chart card, ticker tape, pulse bar, and dialogs to glass surfaces with subtle inner-border highlight and soft outer shadow.
- Mobile: collapse the 3-column terminal into a bottom-sheet navigator (`Sheet` from shadcn) triggered by a glass tab bar; chart + AI dock stack vertically. Header pill bar becomes horizontally scrollable. All tap targets ≥ 44px. Test at 390×803.

## Technical notes
- Cloud is already enabled → use it for `price_alerts`. Migration includes GRANTs + RLS scoping every row to `auth.uid()`.
- No new external deps beyond `react-window` (+ types).
- Keep existing Finnhub cache + Crypto.com public ticker cache untouched.
- All new server logic in `*.functions.ts` / `*.server.ts` per project rules.

## Out of scope (say if you want them)
- Placing real trades via Crypto.com (write-side).
- Push notifications when the tab is closed (would need a service worker + web-push + cron).
- Third redesign template — you already picked Obsidian Pro; this just skins it in liquid glass.

Reply "go" and I'll build it end-to-end.