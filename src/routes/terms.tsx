import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "./about";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Alpha Brain" },
      { name: "description", content: "Terms governing Alpha Brain: acceptable use, financial-information disclaimers, service limits and rate caps, intellectual property and liability." },
      { property: "og:title", content: "Terms of Service — Alpha Brain" },
      { property: "og:description", content: "Acceptable use, disclaimers, usage limits and liability terms for the Alpha Brain terminal." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p><em>Last updated: 2026</em></p>

      <h2>1. Agreement</h2>
      <p>
        These Terms are a binding agreement between you and Alpha Brain (“we”, “us”), an independent product by
        DOGEKINGMIKE, covering the web app, the installable PWA and the Windows desktop build (together, the
        “Service”). By using the Service you accept these Terms. If you do not accept them, stop using it.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 13 years old, and old enough to trade legally in your jurisdiction if you act on
        anything you read here. You are responsible for complying with the laws that apply to you, including
        any restrictions on securities or digital-asset activity.
      </p>

      <h2>3. What the Service is — and is not</h2>
      <p>
        Alpha Brain is an informational market-intelligence terminal. It aggregates public market, on-chain and
        threat-intelligence data and applies AI reasoning on top. It is <strong>not</strong> a broker, exchange,
        custodian, investment adviser, financial planner or signal service, and it never executes, routes or
        holds orders or funds.
      </p>

      <h2>4. No financial, investment, legal or tax advice</h2>
      <p>
        All output — including AI analyses, market scans, probability figures, price targets, “top picks”,
        pattern detections, risk scores and backtest results — is informational and generic. It does not take
        your circumstances into account and is not a recommendation to buy, sell or hold any asset. AI models
        can be confidently wrong. Backtests use historical data and are not indicative of future results.
        Trading stocks, crypto and on-chain tokens carries substantial risk, including total loss of capital.
        Every decision you make is your own. See the <a href="/disclaimer">Risk Disclaimer</a>.
      </p>

      <h2>5. Data accuracy and availability</h2>
      <p>
        Market data comes from third-party providers and may be delayed, incomplete, cached or wrong. On-chain
        prices derive from pool ratios that can be manipulated. Threat-intelligence records are risk signals,
        not legal findings, and absence from the database does not mean an address is safe. The Service is
        provided on an “as is” and “as available” basis with no uptime guarantee. Coverage and accuracy notes
        are documented on the <a href="/data-sources">Data Sources &amp; Disclosures</a> page.
      </p>

      <h2>6. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Circumvent, script around or overwhelm rate limits, caches or the AI quota.</li>
        <li>Scrape, resell, redistribute or white-label the Service or provider data as your own product.</li>
        <li>Reverse-engineer server functions, or attempt to extract API keys, secrets or credentials.</li>
        <li>Plug the Service into automated or high-frequency trading systems without our written permission.</li>
        <li>Use the AI to generate unlawful, defamatory, harassing or deliberately misleading financial content.</li>
        <li>Use threat-intelligence records to harass, dox or falsely accuse any person or entity.</li>
        <li>Upload malware, probe for vulnerabilities beyond good-faith responsible disclosure, or interfere with other users.</li>
      </ul>

      <h2>7. Service limits, quotas and pricing</h2>
      <p>
        Alpha Brain is currently offered free of charge with <strong>no subscription and no paid tier</strong>.
        To keep it that way, AI and data endpoints enforce per-IP rate limits and a daily global cap; when a
        cap is reached, AI panels stop until the window resets. Limits may change without notice. If a paid
        plan is ever introduced, pricing, billing and cancellation terms will be published before it applies,
        and existing free functionality will not be retroactively charged for.
      </p>

      <h2>8. Third-party services</h2>
      <p>
        The Service depends on Finnhub, the Crypto.com Exchange public API, DexScreener, GeckoTerminal, the
        Lovable AI Gateway, TradingView Lightweight Charts and ScamWatch × Nova. Their own terms apply to their
        data, and we are not responsible for their availability, accuracy or acts. Links to third-party sites
        are not endorsements.
      </p>

      <h2>9. Intellectual property</h2>
      <p>
        The Alpha Brain name, interface, design system and original code are ours or our licensors'. You get a
        personal, revocable, non-exclusive licence to use the Service for your own market research. Provider
        data remains the property of the respective provider. Threat-intelligence records published in the
        Intelligence Center are free to view, copy and export, with attribution to ScamWatch × Nova.
      </p>

      <h2>10. Desktop build</h2>
      <p>
        The Windows build is distributed as an unsigned package, so Windows SmartScreen may warn on first run.
        Only download it from our <a href="/download">official download page</a>. We are not responsible for
        builds obtained elsewhere or modified by third parties.
      </p>

      <h2>11. Your content</h2>
      <p>
        You keep ownership of the questions and notes you enter. Do not submit personal data, credentials or
        seed phrases. You grant us the limited right to process your input solely to generate the response you
        requested.
      </p>

      <h2>12. Disclaimer of warranties</h2>
      <p>
        To the maximum extent permitted by law, we disclaim all warranties, express or implied, including
        merchantability, fitness for a particular purpose, accuracy, non-infringement and uninterrupted
        availability.
      </p>

      <h2>13. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, we are not liable for any trading losses, lost profits, lost
        opportunity, data loss, or indirect, incidental, special, consequential or punitive damages arising from
        your use of — or inability to use — the Service, even if advised of the possibility. Where liability
        cannot be excluded, our total aggregate liability is limited to the greater of the amount you paid us in
        the preceding twelve months (currently zero) or USD 50.
      </p>

      <h2>14. Indemnity</h2>
      <p>
        You agree to indemnify and hold us harmless from claims arising out of your misuse of the Service, your
        breach of these Terms, or your violation of any law or third-party right.
      </p>

      <h2>15. Suspension and termination</h2>
      <p>
        We may throttle, suspend or terminate access at any time — in particular for abuse of quotas or breach
        of section 6 — and may modify or discontinue features without notice. You may stop using the Service at
        any time; clearing site data removes everything stored locally.
      </p>

      <h2>16. Changes to these Terms</h2>
      <p>
        We may update these Terms; the “last updated” date will change. Continued use after an update
        constitutes acceptance.
      </p>

      <h2>17. Governing law and severability</h2>
      <p>
        These Terms are governed by the laws applicable at our principal place of business, without regard to
        conflict-of-law rules, and without limiting any mandatory consumer rights you hold locally. If a
        provision is unenforceable, the rest remains in force.
      </p>

      <h2>18. Contact</h2>
      <p>
        <a href="mailto:xapp431@gmail.com">xapp431@gmail.com</a> · Related:{" "}
        <a href="/privacy">Privacy Policy</a>, <a href="/cookies">Cookie Policy</a>,{" "}
        <a href="/disclaimer">Risk Disclaimer</a>, <a href="/data-sources">Data Sources</a>.
      </p>
    </LegalShell>
  );
}
