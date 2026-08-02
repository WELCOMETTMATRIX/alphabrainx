import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "./about";
import { openCookieSettings } from "@/components/CookieConsent";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Alpha Brain" },
      { name: "description", content: "How Alpha Brain collects, uses, stores and shares market data, notifications, diagnostics and anything you type — with a clear contact section." },
      { property: "og:title", content: "Privacy Policy — Alpha Brain" },
      { property: "og:description", content: "No accounts, no ad tracking. Watchlists and alerts stay on your device. Full detail on data handling and your rights." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p><em>Last updated: 2026 · Maintained by the Alpha Brain team (DOGEKINGMIKE).</em></p>
      <p>
        Alpha Brain is a read-only market intelligence terminal. There are no user accounts, no profiles and no
        advertising networks. This policy explains, in plain language, every category of information involved
        when you use the web app, the installable PWA or the Windows desktop build.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Alpha Brain is an independent product built by DOGEKINGMIKE. For any privacy question or request,
        contact <a href="mailto:xapp431@gmail.com">xapp431@gmail.com</a> — see section 12.
      </p>

      <h2>2. What we do not collect</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>No account, name, password or date of birth — the app has no sign-up.</li>
        <li>No wallet connection, private keys, seed phrases or exchange API keys from you.</li>
        <li>No brokerage credentials, balances, positions or order history.</li>
        <li>No advertising identifiers, cross-site tracking pixels or data sales.</li>
      </ul>

      <h2>3. Market and asset data (stocks, crypto, on-chain)</h2>
      <p>
        Prices, candles, indicators, liquidity and contract addresses are public market data fetched from
        Finnhub, the Crypto.com Exchange public API, DexScreener and GeckoTerminal through our server
        functions. Requests are proxied so those providers see our server rather than your browser. The
        symbols you look at are processed only to answer that request and to populate short-lived caches
        (seconds to minutes) that keep us inside provider rate limits. Full coverage and accuracy notes are on
        the <a href="/data-sources">Data Sources &amp; Disclosures</a> page.
      </p>

      <h2>4. Your watchlists, alerts and layout (user content)</h2>
      <p>
        Watchlists, price alerts, alert sound and repeat settings, panel layout, selected template and last
        viewed asset are stored in your browser's local storage <strong>on your device</strong>. They are not
        uploaded, not backed up by us and not visible to us. Clearing site data deletes them permanently.
      </p>

      <h2>5. Notifications</h2>
      <p>
        Price alerts are evaluated locally in your browser against live quotes. If you grant notification
        permission, alerts are delivered through your browser's own notification system, optionally with a
        sound and vibration. We operate no push server and hold no device push tokens. Revoke the permission
        in your browser or OS settings at any time.
      </p>

      <h2>6. Anything you type into the AI</h2>
      <p>
        Questions you send to the AI Analyst, scanner or on-chain analysis are forwarded, together with the
        market data already on screen, to the Lovable AI Gateway to generate a response. Do not paste personal
        data, credentials, seed phrases or confidential information into the AI input. We do not use your
        prompts to build a profile of you.
      </p>

      <h2>7. Server logs, security and rate limiting</h2>
      <p>
        Our serverless functions temporarily process the IP address and standard request metadata of each call
        to enforce per-IP rate limits and a daily global cap that protect the service from abuse and cost
        attacks. These logs rotate automatically and are used only for security, debugging and capacity
        planning — never for profiling or marketing.
      </p>

      <h2>8. Analytics and diagnostics</h2>
      <p>
        Alpha Brain uses <strong>no third-party product analytics and no advertising SDKs</strong>. Anonymous
        crash and runtime-error reports may be sent so broken panels can be fixed; you can switch this off
        under the Diagnostics category in{" "}
        <button onClick={openCookieSettings} className="text-cyan-400 underline">cookie settings</button>. Our
        hosting provider may keep standard infrastructure request logs.
      </p>

      <h2>9. Sharing</h2>
      <p>
        We do not sell, rent or trade information. Data is shared only with the processors needed to run the
        product: our hosting/serverless provider, the market and on-chain data providers listed above, the
        Lovable AI Gateway, and ScamWatch × Nova for Intelligence Center content. Each operates under its own
        privacy policy. We may disclose information if legally compelled.
      </p>

      <h2>10. Retention</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Device storage (watchlists, alerts, preferences): until you clear it.</li>
        <li>Server caches of market data: seconds to minutes.</li>
        <li>Rate-limit counters: rolling windows measured in minutes and one day.</li>
        <li>Operational logs: rotated automatically; no long-term archive of personal data.</li>
      </ul>

      <h2>11. Your rights</h2>
      <p>
        Because we hold no account data, most of your data is already under your direct control — clearing site
        data is an immediate, complete erasure. Where applicable law (for example GDPR or UK GDPR) grants you
        rights of access, correction, erasure, restriction, objection or portability over anything we do hold,
        email us and we will respond, normally within 30 days.
      </p>

      <h2>12. Children</h2>
      <p>Alpha Brain is not directed to children under 13 and we do not knowingly collect their information.</p>

      <h2>13. International use</h2>
      <p>
        The app is served from globally distributed edge infrastructure, so requests may be processed in a
        country other than your own. We use providers that apply appropriate safeguards for such transfers.
      </p>

      <h2>14. Changes to this policy</h2>
      <p>
        Material changes will be reflected in the “last updated” date, and where required we will re-request
        consent. Continued use after an update means you accept the revised policy.
      </p>

      <h2>15. Contact</h2>
      <p>
        Email: <a href="mailto:xapp431@gmail.com">xapp431@gmail.com</a><br />
        Product Hunt: <a href="https://www.producthunt.com/@dogekingmike" target="_blank" rel="noopener">@dogekingmike</a><br />
        Typical response time: within 48 hours, Mon–Fri.
      </p>
      <p>
        Related: <a href="/cookies">Cookie Policy</a> · <a href="/terms">Terms of Service</a> ·{" "}
        <a href="/disclaimer">Risk Disclaimer</a> · <a href="/data-sources">Data Sources</a>.
      </p>
    </LegalShell>
  );
}
