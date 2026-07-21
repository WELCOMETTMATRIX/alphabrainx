import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "./about";
import { Download, Monitor, Apple, Smartphone } from "lucide-react";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Download Alpha Brain for Windows" },
      { name: "description", content: "Download the Alpha Brain desktop terminal for Windows (.exe). macOS, iOS, Android available as PWA." },
    ],
  }),
  component: DownloadPage,
});

const WIN_URL = "/__l5e/assets-v1/31064dc2-65b0-4464-a620-64c0b701014a/AlphaBrain-Setup-win-x64.zip";

function DownloadPage() {
  return (
    <LegalShell title="Download Alpha Brain">
      <p>Install Alpha Brain as a native desktop app for the fastest experience — no browser tabs, dedicated window, system-tray alerts.</p>

      <div className="not-prose mt-6 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 p-6">
        <div className="flex items-center gap-3">
          <Monitor className="w-8 h-8 text-cyan-400" />
          <div>
            <div className="text-white font-bold text-lg">Windows 10 / 11 (x64)</div>
            <div className="text-xs text-slate-400 font-mono">AlphaBrain-Setup-win-x64.zip · Electron build</div>
          </div>
        </div>
        <a
          href={WIN_URL}
          download
          className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition-colors"
        >
          <Download className="w-5 h-5" />
          Download for Windows
        </a>
        <p className="mt-3 text-xs text-slate-400">Unzip and run <code className="text-cyan-300">AlphaBrain.exe</code>. Windows may warn about an unsigned publisher — click <em>More info → Run anyway</em>.</p>
      </div>

      <h2>macOS & Linux</h2>
      <p className="flex items-center gap-2"><Apple className="w-4 h-4" /> macOS build coming soon. In the meantime, use the browser or install as a PWA.</p>

      <h2>iOS & Android (PWA)</h2>
      <p className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> Open Alpha Brain in Safari (iOS) or Chrome (Android) → <em>Share → Add to Home Screen</em>. You'll get a full-screen app icon with offline shell caching.</p>

      <h2>What's included</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Live stocks (Finnhub) & crypto (Crypto.com Exchange)</li>
        <li>On-chain scanner across 30+ chains</li>
        <li>AI Brain — technical reads, regime detection, backtesting</li>
        <li>Price alerts polled every 5s</li>
        <li>TradingView-quality Lightweight Charts</li>
      </ul>
    </LegalShell>
  );
}
