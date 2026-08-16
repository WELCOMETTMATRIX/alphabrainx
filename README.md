# Alpha

CREATE A AI APP LIKE THIS THE APP WILL USE AI TO TRACK THE VALUE OF STOCKS LIVE DATA , AND I HAVE MY FINNHUB API , AND USE FREE API TOO AND MAKE SURE THE AI HAVE A BRIAN SYSTEM WHERE HE CAN COMPARE PRICES GIVE TOP ADVVICES , FIND ANY PATH OF PRICES GOING UP AND MORE FEATURES = AND SHOULD LOAD BINANCE CRYPTO PRICES AND DO SAME FOR THEM AND THE APP SHOULD HAVE CHARTS TradingView Lightweight Charts (Easiest)

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://alphabrain.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9c0cc3b0-5955-48eb-a0a4-236da4ae23af).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Market Intelligence Architecture

Alpha Brain is a stock + crypto market intelligence app built around live APIs and deterministic application logic:

```text
Market APIs → Data Collection → Normalization → Validation → Alpha Brain AI Engine → Risk/Confidence → Rankings → UI + Alerts
```

The app does **not** require a database. It uses in-memory caching, request de-duplication, provider fallbacks where available, and client-side local storage for watchlists and alert preferences.

### Data Sources

- Finnhub powers US stock, ETF, and market index quotes. Configure `FINNHUB_API_KEY` server-side.
- Crypto.com Exchange public endpoints power centralized crypto tickers and candles.
- DexScreener and GeckoTerminal support on-chain token exploration where existing routes use them.
- The existing Alpha Brain AI integration remains part of the app; no extra Lovable API setup is required in this template.

### Token Discovery & Verification

Crypto discovery is dynamic. The engine loads available trading pairs, normalizes by base asset, validates price/volume fields, compares available quote markets, scores liquidity, volume, momentum, data reliability, and risk signals, then classifies tokens as verified, community, unverified, or high-risk. Missing or conflicting evidence reduces confidence rather than promoting a token.

### Alerts

Alerts are evaluated against live quote state with crossing detection and cooldowns so an active condition does not spam duplicate notifications. Browser notification permission is optional and managed by the user.

## Configuration

```sh
cp .env.example .env.local
npm i
npm run dev
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `FINNHUB_API_KEY` | yes | Stock, ETF and index quotes ([finnhub.io](https://finnhub.io), free tier works) |
| `CRYPTO_COM_API_KEY` | optional | Authenticated Crypto.com Exchange endpoints (public tickers work without it) |
| `CRYPTO_COM_API_SECRET` | optional | Pairs with the key above |
| `LOVABLE_API_KEY` | for AI features | AI Analyst, scanner and on-chain analysis via the Lovable AI Gateway |
| `AI_DAILY_BUDGET` | optional | Global daily AI request cap |
| `AI_PER_IP_HOURLY` | optional | Per-IP hourly AI request cap |

All keys are read server-side only, inside server functions — nothing is exposed to the browser.

For production builds, run:

```sh
npm run build
```

## Security

Never commit API keys. Keep provider credentials in server-side environment variables (`.env.local` is git-ignored), and see `SECURITY.md` for reporting guidance.

## Contributing

Contributions are welcome. Read `CONTRIBUTING.md` for the workflow and `CODE_OF_CONDUCT.md` for community expectations. Preserve existing branding and do not rewrite published Lovable git history.

## License

Released under the [MIT License](LICENSE) — free to use, modify and distribute with attribution.

## Disclaimer

Alpha Brain is an informational market-intelligence tool. Nothing it outputs is financial, investment, legal or tax advice. Trading carries substantial risk, including total loss of capital.

