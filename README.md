# Alpha
# Build an AI-Powered Live Stock & Crypto Intelligence Platform

Create a modern, production-ready AI financial intelligence application that monitors **stocks and cryptocurrencies using live market data**, analyzes price movement, identifies patterns, compares assets, and provides intelligent, evidence-based market insights.

The application should feel like a combination of a **professional trading dashboard, AI research analyst, market scanner, and crypto terminal**.

## 1. Live Market Data

I already have a **Finnhub API key**. Integrate Finnhub as one of the primary market-data sources.

Also support additional free/public APIs where legally and technically appropriate to improve coverage and provide fallback data.

The application should:

* Load live or near-real-time stock prices
* Load historical prices
* Load volume
* Load OHLC data
* Load market information
* Load company information
* Load financial metrics when available
* Load relevant market/news data
* Handle API rate limits
* Cache data intelligently
* Automatically retry failed requests
* Fall back to another data source when appropriate
* Clearly display the timestamp and source of market data
* Never display fake "live" prices when the source is delayed or unavailable

The system should clearly distinguish:

**LIVE**

**DELAYED**

**HISTORICAL**

**UNAVAILABLE**

---

# 2. Binance Crypto Integration

Add cryptocurrency market data using the **Binance API**.

The crypto section should support major trading pairs such as:

* BTC/USDT
* ETH/USDT
* SOL/USDT
* BNB/USDT
* XRP/USDT
* DOGE/USDT
* ADA/USDT
* AVAX/USDT

Do not hard-code only these assets. Allow the application to dynamically discover supported Binance symbols.

For crypto, display:

* Current price
* 24h change
* 24h high
* 24h low
* Volume
* Bid/ask when available
* Candlestick data
* Trading activity
* Historical price movement
* Volatility
* Market momentum

The same AI analysis engine used for stocks should also work with crypto.

---

# 3. AI "Brain" System

The most important feature is the AI intelligence layer.

Do not create a simple chatbot that just summarizes prices.

Build an actual **Market Intelligence Engine**.

The AI should combine multiple signals before producing an analysis.

For every asset, calculate and evaluate:

* Price momentum
* Short-term trend
* Medium-term trend
* Long-term trend
* Volume momentum
* Volatility
* Support levels
* Resistance levels
* Moving averages
* RSI
* MACD
* EMA
* SMA
* Bollinger Bands
* Price acceleration
* Breakouts
* Pullbacks
* Trend reversals
* Relative strength
* Market correlation
* Recent news sentiment
* Historical behavior

The AI should explain **why** it reaches a conclusion.

Do not simply say:

> "AAPL may go up."

Instead provide reasoning such as:

> "Momentum is strengthening, price is above the 20/50-day moving averages, volume is increasing, and the current price is approaching a previously observed resistance level. The setup is therefore bullish, but a breakout confirmation is still required."

---

# 4. Market Direction Detection

Create an AI trend engine capable of classifying an asset as:

* Strong Bullish
* Bullish
* Neutral
* Bearish
* Strong Bearish

The classification should be based on multiple indicators rather than one technical indicator.

Create a **confidence score** from 0–100.

Example:

**AAPL**

**Bullish — 82% confidence**

Reasons:

* Positive short-term momentum
* Price above key moving averages
* Increasing volume
* Positive relative strength
* Resistance approaching

The confidence score must represent the strength of the available evidence, **not a guaranteed probability that the price will rise**.

---

# 5. Find Potential Price Paths

Add a feature called **AI Price Path Analysis**.

The system should analyze multiple possible scenarios instead of pretending it can predict the future with certainty.

For example:

### Bullish Scenario

Price breaks resistance with strong volume.

Possible path:

**$180 → $185 → $192**

### Neutral Scenario

Price remains inside the current trading range.

Possible path:

**$180 → $178–$184**

### Bearish Scenario

Support breaks with increasing selling pressure.

Possible path:

**$180 → $174 → $168**

Each scenario should include:

* Trigger
* Supporting evidence
* Key levels
* Invalidating condition
* Confidence
* Risk factors

Never present these as guaranteed predictions.

---

# 6. AI Support & Resistance Detection

Automatically identify important price levels.

The system should detect:

* Historical support
* Historical resistance
* Recent highs
* Recent lows
* Breakout levels
* Breakdown levels
* High-volume price areas
* Moving-average support/resistance

Display these directly on the chart.

The AI should explain:

> "This resistance level has been tested three times over the selected period."

Where sufficient historical data exists.

---

# 7. Breakout Detection

Create an automated **Breakout Scanner**.

Detect potential breakouts using combinations of:

* Price crossing resistance
* Volume expansion
* Momentum acceleration
* Volatility expansion
* Moving-average confirmation
* Recent consolidation
* Relative strength

Separate:

**Potential Breakout**

from

**Confirmed Breakout**

A breakout should not be classified as confirmed from price movement alone.

---

# 8. Early Momentum Detection

Create an **AI Opportunity Scanner** that searches the supported market universe for assets showing unusual changes.

Look for:

* Increasing momentum
* Increasing volume
* Breakout preparation
* Strong relative strength
* Trend acceleration
* Oversold recovery
* Bullish moving-average crossovers
* Bearish reversals
* Unusual volatility
* Strong news catalysts

Rank results by an explainable score.

Example:

### AI Market Opportunities

**1. NVDA — 91/100**

Momentum acceleration + volume expansion + bullish trend.

**2. BTC/USDT — 87/100**

Breakout setup + increasing volume + positive momentum.

**3. AMD — 81/100**

Trend recovery + relative strength improvement.

These rankings should be generated dynamically from current data, not hard-coded.

---

# 9. Stock vs Stock Comparison

Allow users to compare multiple assets.

Example:

**AAPL vs MSFT vs NVDA**

Compare:

* Current price
* Daily performance
* Weekly performance
* Monthly performance
* Volatility
* Momentum
* Volume
* RSI
* MACD
* Trend strength
* Relative strength
* Valuation metrics when available
* News sentiment
* AI score

Then have the AI explain:

> "NVDA currently has the strongest momentum, while MSFT has lower volatility. AAPL is showing weaker short-term momentum but remains above its longer-term trend."

---

# 10. Stock vs Crypto Comparison

The same comparison engine should work across asset classes.

Example:

**NVDA vs BTC vs ETH**

Compare:

* Performance
* Momentum
* Volatility
* Trend
* Volume
* Risk
* Correlation
* AI confidence

Clearly label that stocks and crypto have different market structures and trading hours.

---

# 11. Professional Charts

Use **TradingView Lightweight Charts** as the primary charting library.

The charts should support:

* Candlesticks
* Line charts
* Area charts
* Volume
* Moving averages
* EMA
* SMA
* Bollinger Bands
* RSI
* MACD
* Support/resistance
* Buy/sell markers
* Breakout markers
* AI-generated levels

The chart should update automatically as new market data arrives.

Allow users to change:

* 1m
* 5m
* 15m
* 1h
* 4h
* 1D
* 1W

depending on the data source and asset.

---

# 12. AI Chart Intelligence

Add an **"Analyze Chart"** button.

When clicked, the AI should inspect the selected asset and timeframe and produce:

### Market Structure

* Current trend
* Trend strength
* Support
* Resistance

### Momentum

* Momentum direction
* Acceleration/deceleration
* RSI condition
* MACD condition

### Volume

* Increasing/decreasing
* Unusual volume
* Confirmation or divergence

### Scenarios

* Bullish
* Neutral
* Bearish

### Important Levels

* Entry zone
* Resistance
* Support
* Invalidation level

The AI must clearly distinguish analysis from financial certainty.

---

# 13. News Intelligence

Integrate available financial/news APIs.

The AI should analyze recent news and determine:

* Positive sentiment
* Negative sentiment
* Neutral sentiment
* Potential market impact
* Relevant company/asset
* Whether the news appears material

Then connect news to price movement.

For example:

> "The asset gained 4.2% after increased volume and positive company news. The timing suggests the news may be contributing to the current momentum."

Do not claim causation unless the evidence supports it.

---

# 14. Market Scanner

Create a global scanner.

Users should be able to filter by:

* Biggest gainers
* Biggest losers
* Highest volume
* Unusual volume
* Strong momentum
* Weak momentum
* Breakout candidates
* Breakdown candidates
* RSI oversold
* RSI overbought
* Bullish trend
* Bearish trend
* High volatility
* Low volatility

For crypto, scan Binance-supported markets.

For stocks, scan the supported stock universe available through the connected APIs.

---

# 15. Watchlists

Users should be able to create watchlists.

Example:

**My Watchlist**

* NVDA
* AAPL
* TSLA
* BTC/USDT
* ETH/USDT

For every watchlist item show:

* Live price
* Change
* Trend
* AI score
* Volume
* Alert status

The watchlist should update without requiring a page refresh.

---

# 16. Smart Alerts

Create intelligent alerts rather than only simple price alerts.

Examples:

**Price Alert**

"Notify me when BTC exceeds $120,000."

**Breakout Alert**

"Notify me if NVDA breaks resistance with increased volume."

**Momentum Alert**

"Notify me when an asset's momentum score exceeds 80."

**Trend Alert**

"Notify me when AAPL changes from bearish to bullish."

**Volatility Alert**

"Notify me when BTC volatility increases significantly."

---

# 17. AI Market Briefing

Create a dashboard called:

## AI Market Briefing

Every time the user opens it, generate a current market summary from available data.

Include:

### Market Direction

Bullish / Neutral / Bearish

### Strongest Assets

Top assets showing positive momentum.

### Weakest Assets

Assets showing deteriorating momentum.

### Breakout Watch

Assets approaching important technical levels.

### Risk Watch

Assets showing unusual volatility or negative signals.

### News Watch

Important recent developments.

The briefing must be generated from current available data and show the data timestamp.

---

# 18. AI Memory / Brain

Create a structured **AI Brain layer** rather than relying only on conversation history.

The brain should maintain structured information such as:

* Asset history
* Previous analysis
* Previous predictions/scenarios
* Indicator states
* Historical signals
* Successful/failed signals
* User watchlists
* Alert history
* Market regimes

This allows the AI to compare current conditions with previous conditions.

For example:

> "The current BTC setup resembles three previous high-volume breakout conditions in the selected historical period, although the current volatility is higher."

The system should never invent historical comparisons. If insufficient data exists, explicitly state that.

---

# 19. Prediction Tracking

If the AI generates a scenario, save it.

For example:

**Prediction created:**

BTC bullish scenario

Trigger: $120,000

Target zone: $125,000–$128,000

Invalidation: $116,000

Then later evaluate what actually happened.

This allows the application to measure:

* Signal accuracy
* False positives
* False negatives
* Average movement after signals
* Historical performance of strategies

This is extremely important because it prevents the AI from simply making predictions without accountability.

---

# 20. Backtesting

Add a backtesting engine.

Users should be able to test strategies against historical data.

Example:

> "Test this strategy on NVDA for the last 3 years."

The engine should report:

* Total trades
* Winning trades
* Losing trades
* Win rate
* Average return
* Maximum drawdown
* Profit factor
* Sharpe ratio where appropriate
* Best period
* Worst period

Clearly separate **historical backtesting** from live trading.

---

# 21. Risk Engine

Every AI recommendation should include risk information.

Instead of only:

**BUY**

show:

**Bullish setup**

**Confidence: 82/100**

**Risk: Medium**

**Key resistance: $X**

**Key support: $Y**

**Invalidation: $Z**

**Reason:** ...

Avoid presenting AI output as guaranteed investment advice.

---

# 22. Data Reliability Layer

Build a dedicated data-quality system.

The application should detect:

* Missing prices
* Stale prices
* API failures
* Duplicate candles
* Invalid timestamps
* Out-of-order candles
* Unexpected price jumps
* Missing volume
* Rate-limit errors

Do not allow corrupted market data to silently enter the AI engine.

If data quality is poor, display:

**Analysis temporarily limited — insufficient reliable market data.**

---

# 23. Architecture

Use a clean architecture separating:

### Frontend

* React
* TypeScript
* Tailwind
* TradingView Lightweight Charts

### Market Data Layer

* Finnhub
* Binance
* Additional free APIs
* WebSocket where available
* REST fallback

### Intelligence Layer

* Technical-analysis engine
* AI reasoning engine
* Scoring engine
* Pattern detection
* News analysis
* Correlation engine

### Backend

* Secure API layer
* Authentication
* Database
* Caching
* Background jobs
* WebSocket/event streaming

### Storage

Store:

* Assets
* Price history
* Market observations
* Indicators
* AI analyses
* Signals
* Alerts
* Watchlists
* Prediction outcomes
* Data-source metadata

Never expose private API keys in frontend code.

---

# 24. Performance

The application should feel live and fast.

Use:

* WebSockets when available
* Efficient caching
* Incremental updates
* Debounced searches
* Lazy loading
* Background analysis
* Server-side API calls
* Request deduplication

Do not repeatedly request the same market data from external APIs.

Respect every provider's rate limits and terms.

---

# 25. Main Dashboard

Create a professional dashboard containing:

### Market Overview

S&P 500
NASDAQ
Dow Jones
Bitcoin
Ethereum

### AI Market Sentiment

Bullish / Neutral / Bearish

### Top AI Opportunities

Ranked assets.

### Biggest Movers

Gainers and losers.

### Breakout Watch

Potential breakout candidates.

### High Volume

Unusual volume activity.

### Watchlist

User-selected assets.

### AI News

Important market developments.

### Live Chart

Interactive TradingView Lightweight Chart for the selected asset.

---

# 26. Asset Detail Page

When the user clicks an asset, open a full analysis page.

Example:

## NVDA

**$XXX.XX**

**+X.XX%**

### AI Rating

**Bullish — 84/100**

### Chart

Interactive candlestick chart.

### Technical Analysis

Trend
Momentum
RSI
MACD
Volume
Support
Resistance

### AI Scenarios

Bullish
Neutral
Bearish

### News

Recent relevant news.

### Related Assets

Semiconductors / technology / correlated assets.

### AI Explanation

A complete explanation of why the system currently views the asset as bullish, neutral, or bearish.

---

# 27. Design Requirements

The application should look like a serious financial product.

Use:

* Dark professional interface
* Clear typography
* High-density market dashboard
* Smooth chart interactions
* Real-time updates
* Responsive desktop/tablet/mobile layout
* Clear bullish/bearish indicators
* Minimal unnecessary animations
* Fast navigation

Do not make it look like a generic AI chatbot.

It should feel like a **professional market intelligence terminal with an AI analyst built into it**.

---

# 28. Critical Requirement

Do not build fake functionality.

If a feature requires an API, implement the real API integration.

If real-time data is unavailable, show the actual state.

If an AI analysis cannot be generated because data is missing, explain why.

If a market-data provider returns delayed data, label it as delayed.

Do not use hard-coded prices, fake charts, fake AI scores, fake news, or simulated "live" market activity in production.

Every major AI conclusion should be traceable to the underlying market signals and data timestamp.

---

# Final Product Vision

Build **an AI financial intelligence platform that thinks in terms of evidence, trends, scenarios, risk, and historical context — not simply a chatbot that talks about stocks.**

The system should continuously:

**Collect → Validate → Analyze → Compare → Detect Patterns → Score → Explain → Alert → Track Results → Learn From Outcomes**

Support both:

**STOCKS**

and

**CRYPTO**

with:

**Finnhub + Binance + additional appropriate data sources + TradingView Lightweight Charts + AI intelligence.**

The ultimate goal is to give the user a single place where they can ask:

> **"What is happening in the market right now?"**

> **"Which assets are showing the strongest momentum?"**

> **"What stocks or crypto are approaching a breakout?"**

> **"Compare NVDA, AAPL, BTC and ETH."**

> **"Why is this asset moving?"**

> **"What are the bullish, neutral, and bearish scenarios?"**

> **"What happened to the AI's previous signals?"**

And receive answers based on **current data, transparent reasoning, technical evidence, historical context, and measurable outcomes.**

**Build the application so the AI is the intelligence layer of the entire platform — not just a chat box added on top.**


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

