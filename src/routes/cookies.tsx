import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "./about";
import { openCookieSettings } from "@/components/CookieConsent";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — Alpha Brain" },
      { name: "description", content: "Every cookie, local-storage key and tracker Alpha Brain uses, what each is for, how long it lasts and how to opt out." },
      { property: "og:title", content: "Cookie Policy — Alpha Brain" },
      { property: "og:description", content: "Full list of storage keys, purposes, retention and opt-out controls." },
    ],
  }),
  component: CookiePolicyPage,
});

const STORAGE: { key: string; type: string; purpose: string; retention: string; category: string }[] = [
  { key: "ab_cookie_consent_v1", type: "localStorage", purpose: "Remembers your cookie choices so the banner is not shown again.", retention: "Until you clear it or change your choice", category: "Strictly necessary" },
  { key: "ab_theme / template preference", type: "localStorage", purpose: "Stores the selected visual template (Solaris / Nebula).", retention: "Until cleared", category: "Strictly necessary" },
  { key: "Watchlist keys", type: "localStorage", purpose: "Your pinned stocks, crypto pairs and on-chain tokens.", retention: "Until cleared or removed in the app", category: "Functional" },
  { key: "Price-alert keys", type: "localStorage", purpose: "Your alert targets, direction, repeat setting and sound preference.", retention: "Until cleared or deleted in the app", category: "Functional" },
  { key: "Layout / panel state", type: "localStorage", purpose: "Which panels are open, closed or restored, and the last selected asset.", retention: "Until cleared", category: "Functional" },
  { key: "Notification permission", type: "Browser permission", purpose: "Granted by you so price alerts can raise a system notification.", retention: "Managed by your browser or OS", category: "Functional" },
  { key: "Error report payloads", type: "Network (no cookie)", purpose: "Anonymous crash and runtime-error reports used to fix broken panels.", retention: "Rotated automatically in logs", category: "Diagnostics" },
];

function CookiePolicyPage() {
  return (
    <LegalShell title="Cookie Policy">
      <p><em>Last updated: 2026</em></p>
      <p>
        Alpha Brain runs <strong>no advertising cookies, no ad networks and no cross-site tracking pixels</strong>.
        Almost everything the app remembers is kept in your browser's local storage on your own device rather
        than in cookies sent to a server. This page lists all of it.
      </p>

      <h2>1. What we mean by “cookies”</h2>
      <p>
        We use the word broadly to cover cookies, <code>localStorage</code>, <code>sessionStorage</code> and
        browser permissions — any mechanism that stores information on your device.
      </p>

      <h2>2. Categories</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Strictly necessary</strong> — required for the terminal to function and to remember your consent. Cannot be switched off.</li>
        <li><strong>Functional</strong> — your watchlist, alerts, layout and sound settings. Optional; the app still works without them but forgets your setup on reload.</li>
        <li><strong>Diagnostics</strong> — anonymous crash/error reports. Optional.</li>
        <li><strong>Advertising / marketing</strong> — <strong>none used.</strong></li>
      </ul>

      <h2>3. Full inventory</h2>
      <div className="not-prose my-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-white/[0.04] font-mono text-[10px] uppercase tracking-widest text-slate-400">
            <tr>
              <th className="p-3">Key</th><th className="p-3">Type</th><th className="p-3">Purpose</th><th className="p-3">Retention</th><th className="p-3">Category</th>
            </tr>
          </thead>
          <tbody>
            {STORAGE.map((s, i) => (
              <tr key={s.key} className={i % 2 ? "bg-white/[0.02]" : ""}>
                <td className="p-3 font-mono text-[11px] text-cyan-300">{s.key}</td>
                <td className="p-3 text-slate-400">{s.type}</td>
                <td className="p-3 text-slate-300">{s.purpose}</td>
                <td className="p-3 text-slate-400">{s.retention}</td>
                <td className="p-3 text-slate-400">{s.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>4. Third parties</h2>
      <p>
        Market and intelligence requests are proxied through our own server functions, so providers such as
        Finnhub, Crypto.com, DexScreener and GeckoTerminal do not set cookies in your browser. Two exceptions
        load directly from third-party domains and may set their own cookies under their own policies: the
        Product Hunt badge/image and Google Fonts. Details are in the{" "}
        <a href="/data-sources">Data Sources &amp; Disclosures</a> page.
      </p>

      <h2>5. How to opt out</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Use the in-app control below to change categories at any time.</li>
        <li>Clear site data in your browser settings to erase every key listed above.</li>
        <li>Revoke notification permission in your browser or OS settings.</li>
        <li>Use private/incognito browsing so nothing persists after the session.</li>
      </ul>
      <div className="not-prose my-4">
        <button
          onClick={openCookieSettings}
          className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20"
        >
          Open cookie settings
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Turning off functional storage means watchlists and alerts are not saved between sessions.
      </p>

      <h2>6. Changes &amp; contact</h2>
      <p>
        If we add a new storage key or provider we will update this table and re-ask for consent where the law
        requires it. Questions: <a href="mailto:xapp431@gmail.com">xapp431@gmail.com</a>.
      </p>
    </LegalShell>
  );
}
