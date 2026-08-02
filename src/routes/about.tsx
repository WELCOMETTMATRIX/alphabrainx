import { createFileRoute, Link } from "@tanstack/react-router";
import { ProductHuntCard } from "@/components/ProductHuntCard";
import { TrustedBrands } from "@/components/TrustedBrands";


export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Alpha Brain" },
      { name: "description", content: "About Alpha Brain — the AI-powered live market intelligence terminal for stocks, crypto and on-chain tokens." },
      { property: "og:title", content: "About — Alpha Brain" },
      { property: "og:description", content: "AI market intelligence for stocks, crypto and on-chain assets." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <LegalShell title="About Alpha Brain">
      <p>Alpha Brain is a next-generation market intelligence terminal that fuses live stock quotes (Finnhub), crypto markets (Crypto.com Exchange), and multi-chain on-chain data (DexScreener, GeckoTerminal) with a Lovable AI reasoning engine.</p>
      <p>Our mission is to give retail traders the same edge that institutional desks enjoy: instant cross-asset context, technical indicators (RSI, MACD, ATR), a backtesting sandbox, and a "brain" that continuously scans thousands of assets to surface actionable ideas.</p>
      <h2>Built by</h2>
      <p>DOGEKINGMIKE — follow on Product Hunt: <a href="https://www.producthunt.com/@dogekingmike" target="_blank" rel="noopener">@dogekingmike</a>.</p>

      <div className="not-prose my-6">
        <ProductHuntCard />
      </div>

      <h2>Our trusted brands & data partners</h2>
      <p>Every number in Alpha Brain comes from one of these live providers — nothing is simulated.</p>
      <TrustedBrands />

      <h2>Legal & policies</h2>
      <p>
        Read our <Link to="/privacy">Privacy Policy</Link>, <Link to="/terms">Terms of Service</Link>,{" "}
        <Link to="/faq">FAQ</Link> or <Link to="/contact">contact us</Link>.
      </p>

      <h2>Not financial advice</h2>
      <p>Everything Alpha Brain surfaces is informational. Markets carry risk. Never invest more than you can afford to lose.</p>

    </LegalShell>
  );
}

export function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050810] text-slate-200">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link to="/" className="text-xs font-mono uppercase tracking-widest text-cyan-400 hover:text-cyan-300">← Back to terminal</Link>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-white" style={{ fontFamily: "Orbitron, sans-serif" }}>{title}</h1>
        <div className="mt-8 space-y-4 text-sm leading-relaxed text-slate-300 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_a]:text-cyan-400 [&_a:hover]:text-cyan-300 [&_a]:underline">
          {children}
        </div>
        <footer className="mt-14 pt-6 border-t border-white/5 text-[11px] font-mono uppercase tracking-widest text-slate-500 flex flex-wrap gap-4">
          <Link to="/about">About</Link>
          <Link to="/faq">FAQ</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/disclaimer">Disclaimer</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/download">Download</Link>

        </footer>
      </div>
    </div>
  );
}
