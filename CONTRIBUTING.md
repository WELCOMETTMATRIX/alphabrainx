# Contributing to Alpha Brain

Thanks for helping improve Alpha Brain. Keep the existing Lovable-connected product identity intact and prefer small, reviewable changes.

## Development

1. Copy `.env.example` to `.env.local` and add your API keys.
2. Install dependencies with `npm i`.
3. Start the app with `npm run dev`.
4. Verify production output with `npm run build` before opening a PR.

## Architecture Guidelines

- Do not introduce a database or permanent server-side persistence for market data.
- Keep market providers behind normalization, validation, intelligence, and alert layers.
- Never hardcode API keys or secrets.
- Treat missing or inconsistent API data as uncertainty, not as a positive signal.
- Preserve existing Alpha Brain branding, navigation, and Lovable workflow.

5. Read `CODE_OF_CONDUCT.md` before participating in discussions.
