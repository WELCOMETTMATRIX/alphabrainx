import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Brain, Cpu, Database, Eye, Gauge, GitBranch, Globe,
  Layers, Network, Radar, Radio, Shield, Sparkles, Target, Waves, Zap,
} from "lucide-react";

export const Route = createFileRoute("/intelligence")({
  component: IntelligenceCenter,
  head: () => ({
    meta: [
      { title: "AI Intelligence Center — Alpha Brain" },
      { name: "description", content: "Watch the Alpha Brain AI reason in real time — knowledge graph, probability engine, threat intelligence, and live pipeline." },
      { property: "og:title", content: "AI Intelligence Center — Alpha Brain" },
      { property: "og:description", content: "Institutional-grade AI intelligence terminal: knowledge graph, probability engine, threat timeline, and live reasoning." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

// ------- deterministic pseudo-random so the "live" feel is stable per-tick -------
function rng(seed: number) { let s = seed || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }

function useTick(ms = 1500) {
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT((x) => x + 1), ms); return () => clearInterval(id); }, [ms]);
  return t;
}

// ============================================================================
function IntelligenceCenter() {
  return (
    <div className="min-h-screen bg-[#050810] text-slate-200 relative overflow-hidden">
      <ParticleField />
      <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <TopBar />
        <HeroBrain />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <IntelligencePipeline />
            <KnowledgeGraph />
            <ThreatRelationshipMap />
            <PatternRecognition />
          </div>
          <div className="space-y-6">
            <ProbabilityEngine />
            <ConfidenceDashboard />
            <SystemHealth />
            <LiveFeed />
          </div>
        </div>
        <ThreatTimeline />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AIMemory />
          <Explainability />
        </div>
        <Footer />
      </div>
    </div>
  );
}

// ---------- Top bar ----------
function TopBar() {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 rounded-xl bg-cyan-400/40 blur-xl animate-pulse" />
          <div className="relative h-11 w-11 rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 grid place-items-center">
            <Brain className="h-6 w-6 text-black" />
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-cyan-400/80">Alpha Brain // Intelligence</div>
          <div className="text-xl sm:text-2xl font-black tracking-tight">AI Intelligence Center</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <StatusChip color="emerald" label="ONLINE" />
        <StatusChip color="cyan" label="REASONING" pulse />
        <Link to="/" className="glass-pill px-3 py-1.5 text-slate-300 hover:text-white">← Terminal</Link>
      </div>
    </div>
  );
}
function StatusChip({ color, label, pulse }: { color: "emerald" | "cyan" | "amber" | "rose"; label: string; pulse?: boolean }) {
  const map = { emerald: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30", cyan: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30", amber: "text-amber-400 bg-amber-400/10 border-amber-400/30", rose: "text-rose-400 bg-rose-400/10 border-rose-400/30" }[color];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono uppercase tracking-widest text-[10px] ${map}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${pulse ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}

// ---------- Hero: AI Brain live reasoning ----------
const THOUGHTS = [
  "Cross-referencing 4,812 domain registrations against known phishing kits…",
  "Detecting anomalous liquidity movement on Cronos DEX pool 0x9a…",
  "Correlating wallet 0xf7c2 to 3 prior rug-pull incidents (Q3 2025)…",
  "Elevating confidence on cluster 'moonshot-airdrop' from 71% → 88%…",
  "New impersonation vector: fake support handles targeting BTC holders…",
  "Signal decay observed on 'invest-vault[.]io' — reclassifying as dormant…",
  "Pattern match: 14 domains share TLS fingerprint with 2024 lazarus toolkit…",
  "Ingesting 928 new intel points from onchain feed…",
  "Model agreement 96% on threat actor cluster APT-Nebula-7…",
];
function HeroBrain() {
  const tick = useTick(2200);
  const thought = THOUGHTS[tick % THOUGHTS.length];
  const [conf, setConf] = useState(87);
  useEffect(() => { const id = setInterval(() => setConf((c) => Math.max(72, Math.min(98, c + (Math.random() - 0.5) * 4))), 1800); return () => clearInterval(id); }, []);
  return (
    <div className="glass rounded-2xl p-5 sm:p-6 border border-white/10 relative overflow-hidden">
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-cyan-400/80 mb-3">
            <Sparkles className="h-3 w-3" /> Live reasoning stream
          </div>
          <div className="text-lg sm:text-xl font-medium leading-relaxed text-slate-100 min-h-[3.5rem]">
            <span className="text-cyan-300">▸</span> {thought}
            <span className="inline-block w-2 h-5 bg-cyan-400 ml-1 animate-pulse align-middle" />
          </div>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <MiniStat icon={Target} label="Active Objectives" value="12" />
            <MiniStat icon={AlertTriangle} label="Threats Tracked" value="2,481" tone="amber" />
            <MiniStat icon={Shield} label="Blocked (24h)" value="937" tone="emerald" />
            <MiniStat icon={Radar} label="Scans / min" value="1.4k" tone="cyan" />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center">
          <ConfidenceRing value={conf} />
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mt-2">System Confidence</div>
        </div>
      </div>
    </div>
  );
}
function MiniStat({ icon: Icon, label, value, tone = "slate" }: { icon: typeof Target; label: string; value: string; tone?: "slate" | "emerald" | "amber" | "cyan" }) {
  const c = { slate: "text-slate-300", emerald: "text-emerald-400", amber: "text-amber-400", cyan: "text-cyan-400" }[tone];
  return (
    <div className="glass-pill rounded-xl p-3 border border-white/5">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-500"><Icon className="h-3 w-3" /> {label}</div>
      <div className={`text-xl font-black mt-0.5 ${c}`}>{value}</div>
    </div>
  );
}
function ConfidenceRing({ value }: { value: number }) {
  const r = 46, C = 2 * Math.PI * r, off = C - (value / 100) * C;
  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="none" />
        <circle cx="60" cy="60" r={r} stroke="url(#g)" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} style={{ transition: "stroke-dashoffset 900ms ease" }} />
        <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#e879f9" /></linearGradient></defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center"><div className="text-3xl font-black text-white">{value.toFixed(0)}%</div></div>
      </div>
    </div>
  );
}

// ---------- Pipeline ----------
const STAGES = ["Data Collection", "Signal Processing", "Pattern Recognition", "Threat Classification", "AI Reasoning", "Risk Assessment", "Recommendation"];
function IntelligencePipeline() {
  const tick = useTick(900);
  return (
    <Panel title="Intelligence Pipeline" icon={GitBranch} subtitle="Real-time data flow through the reasoning engine">
      <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
        {STAGES.map((s, i) => {
          const active = tick % STAGES.length === i;
          return (
            <div key={s} className="flex items-center gap-2 shrink-0">
              <div className={`glass-pill rounded-xl px-3 py-2.5 border transition-all ${active ? "border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.35)] scale-105" : "border-white/10"}`}>
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Stage {i + 1}</div>
                <div className={`text-xs font-semibold ${active ? "text-cyan-300" : "text-slate-300"}`}>{s}</div>
                <div className="mt-1 h-1 w-full rounded-full bg-white/5 overflow-hidden">
                  <div className={`h-full ${active ? "bg-cyan-400 w-full" : "bg-slate-600 w-1/3"} transition-all duration-500`} />
                </div>
              </div>
              {i < STAGES.length - 1 && <div className="text-slate-600 text-lg">→</div>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ---------- Knowledge Graph ----------
type Node = { id: string; x: number; y: number; r: number; label: string; kind: "domain" | "wallet" | "email" | "ip" | "actor" | "malware" };
const NODES: Node[] = [
  { id: "n1", x: 50, y: 50, r: 18, label: "APT-Nebula-7", kind: "actor" },
  { id: "n2", x: 22, y: 30, r: 10, label: "invest-vault.io", kind: "domain" },
  { id: "n3", x: 78, y: 28, r: 12, label: "0xf7c2…", kind: "wallet" },
  { id: "n4", x: 20, y: 72, r: 9, label: "88.129.4.12", kind: "ip" },
  { id: "n5", x: 76, y: 74, r: 11, label: "support@moon…", kind: "email" },
  { id: "n6", x: 50, y: 15, r: 8, label: "clipper.exe", kind: "malware" },
  { id: "n7", x: 50, y: 88, r: 10, label: "airdrop-safe.net", kind: "domain" },
  { id: "n8", x: 12, y: 52, r: 7, label: "0xa1b3…", kind: "wallet" },
  { id: "n9", x: 88, y: 52, r: 7, label: "meta-claim.xyz", kind: "domain" },
];
const KIND_COLOR: Record<Node["kind"], string> = { actor: "#f43f5e", domain: "#22d3ee", wallet: "#a78bfa", email: "#facc15", ip: "#34d399", malware: "#fb7185" };
const EDGES: [string, string][] = [["n1","n2"],["n1","n3"],["n1","n4"],["n1","n5"],["n1","n6"],["n2","n7"],["n3","n8"],["n5","n9"],["n7","n9"],["n2","n4"]];
function KnowledgeGraph() {
  const tick = useTick(2000);
  return (
    <Panel title="Knowledge Graph" icon={Network} subtitle="Relationships between actors, domains, wallets, and infrastructure">
      <div className="relative w-full aspect-[16/9] rounded-xl bg-black/30 border border-white/5 overflow-hidden">
        <svg viewBox="0 0 100 60" className="absolute inset-0 h-full w-full">
          {EDGES.map(([a, b], i) => {
            const A = NODES.find(n => n.id === a)!, B = NODES.find(n => n.id === b)!;
            const active = (tick + i) % EDGES.length === i % EDGES.length;
            return (
              <line key={i} x1={A.x} y1={A.y * 0.6} x2={B.x} y2={B.y * 0.6}
                stroke={active ? "rgba(34,211,238,0.9)" : "rgba(148,163,184,0.25)"}
                strokeWidth={active ? "0.35" : "0.15"}
                style={{ transition: "all 700ms" }} />
            );
          })}
          {NODES.map((n) => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y * 0.6} r={n.r / 6} fill={KIND_COLOR[n.kind]} opacity="0.2" />
              <circle cx={n.x} cy={n.y * 0.6} r={n.r / 10} fill={KIND_COLOR[n.kind]} />
              <text x={n.x} y={n.y * 0.6 + n.r / 6 + 2.5} textAnchor="middle" fontSize="1.8" fill="rgba(226,232,240,0.85)" fontFamily="monospace">{n.label}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap gap-2 mt-3 text-[10px] font-mono uppercase tracking-widest">
        {Object.entries(KIND_COLOR).map(([k, c]) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-slate-400">
            <span className="h-2 w-2 rounded-full" style={{ background: c }} /> {k}
          </span>
        ))}
      </div>
    </Panel>
  );
}

// ---------- Threat Relationship Map (force-directed feel via animated positions) ----------
function ThreatRelationshipMap() {
  const tick = useTick(50);
  const nodes = useMemo(() => Array.from({ length: 26 }, (_, i) => {
    const r = rng(i + 1);
    return { i, baseX: r() * 100, baseY: r() * 100, amp: 1 + r() * 2, phase: r() * Math.PI * 2, color: ["#22d3ee", "#a78bfa", "#f43f5e", "#34d399", "#facc15"][i % 5] };
  }), []);
  return (
    <Panel title="Threat Relationship Map" icon={Waves} subtitle="Force-directed cluster of infrastructure & attackers">
      <div className="relative w-full aspect-[16/8] rounded-xl bg-gradient-to-br from-black/40 to-fuchsia-950/20 border border-white/5 overflow-hidden">
        <svg viewBox="0 0 100 50" className="absolute inset-0 h-full w-full">
          {nodes.map((a, i) => nodes.slice(i + 1).map((b, j) => {
            const dx = a.baseX - b.baseX, dy = a.baseY - b.baseY;
            const d = Math.hypot(dx, dy);
            if (d > 22) return null;
            return <line key={`${i}-${j}`} x1={a.baseX} y1={a.baseY * 0.5} x2={b.baseX} y2={b.baseY * 0.5} stroke="rgba(148,163,184,0.15)" strokeWidth="0.1" />;
          }))}
          {nodes.map((n) => {
            const x = n.baseX + Math.sin(tick / 20 + n.phase) * n.amp;
            const y = n.baseY + Math.cos(tick / 20 + n.phase) * n.amp;
            return (
              <g key={n.i}>
                <circle cx={x} cy={y * 0.5} r="1.6" fill={n.color} opacity="0.25" />
                <circle cx={x} cy={y * 0.5} r="0.7" fill={n.color} />
              </g>
            );
          })}
        </svg>
        <div className="absolute bottom-2 left-3 text-[10px] font-mono uppercase tracking-widest text-slate-500">26 entities · 41 edges · updating</div>
      </div>
    </Panel>
  );
}

// ---------- Pattern Recognition ----------
const CLUSTERS = [
  { name: "Phishing · fake-support", size: 148, delta: "+12", tone: "rose" },
  { name: "Rug-pull · new-launch", size: 87, delta: "+5", tone: "amber" },
  { name: "Impersonation · brand", size: 63, delta: "+2", tone: "amber" },
  { name: "Malicious domains · TLS-reuse", size: 214, delta: "+31", tone: "rose" },
  { name: "Fake investment platforms", size: 96, delta: "+7", tone: "amber" },
  { name: "Crypto giveaway scams", size: 178, delta: "+18", tone: "rose" },
] as const;
function PatternRecognition() {
  return (
    <Panel title="Pattern Recognition" icon={Layers} subtitle="Live-evolving threat clusters">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {CLUSTERS.map((c) => (
          <div key={c.name} className="glass-pill rounded-xl p-3 border border-white/5 relative overflow-hidden group">
            <div className={`absolute -right-6 -top-6 h-16 w-16 rounded-full blur-2xl ${c.tone === "rose" ? "bg-rose-500/30" : "bg-amber-500/30"}`} />
            <div className="relative">
              <div className="text-xs font-semibold text-slate-100">{c.name}</div>
              <div className="flex items-end justify-between mt-1">
                <div className="text-2xl font-black text-white">{c.size}</div>
                <div className={`text-xs font-mono ${c.tone === "rose" ? "text-rose-400" : "text-amber-400"}`}>{c.delta} 24h</div>
              </div>
              <div className="h-1 w-full rounded-full bg-white/5 mt-2 overflow-hidden">
                <div className={`h-full ${c.tone === "rose" ? "bg-rose-500" : "bg-amber-500"} animate-pulse`} style={{ width: `${Math.min(100, c.size / 2.5)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ---------- Probability Engine ----------
function ProbabilityEngine() {
  const [bins, setBins] = useState<number[]>(() => Array.from({ length: 12 }, (_, i) => 20 + Math.abs(6 - i) * 4 + Math.random() * 10));
  useEffect(() => {
    const id = setInterval(() => setBins((b) => b.map((v) => Math.max(6, Math.min(100, v + (Math.random() - 0.5) * 8)))), 1200);
    return () => clearInterval(id);
  }, []);
  return (
    <Panel title="Probability Engine" icon={Gauge} subtitle="Confidence distribution & risk decomposition">
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Metric label="Malicious" value="72%" tone="rose" />
        <Metric label="Suspicious" value="21%" tone="amber" />
        <Metric label="Benign" value="7%" tone="emerald" />
      </div>
      <div className="flex items-end gap-1 h-24">
        {bins.map((v, i) => (
          <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-cyan-500/40 to-fuchsia-500/70 transition-all" style={{ height: `${v}%` }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        <div className="flex justify-between glass-pill rounded-lg px-3 py-1.5"><span className="text-slate-400">Risk score</span><span className="font-mono text-rose-400">8.4</span></div>
        <div className="flex justify-between glass-pill rounded-lg px-3 py-1.5"><span className="text-slate-400">Uncertainty</span><span className="font-mono text-amber-400">0.12</span></div>
        <div className="flex justify-between glass-pill rounded-lg px-3 py-1.5"><span className="text-slate-400">Evidence</span><span className="font-mono text-cyan-400">37</span></div>
        <div className="flex justify-between glass-pill rounded-lg px-3 py-1.5"><span className="text-slate-400">Models agree</span><span className="font-mono text-emerald-400">96%</span></div>
      </div>
    </Panel>
  );
}
function Metric({ label, value, tone }: { label: string; value: string; tone: "rose" | "amber" | "emerald" | "cyan" }) {
  const c = { rose: "text-rose-400", amber: "text-amber-400", emerald: "text-emerald-400", cyan: "text-cyan-400" }[tone];
  return (
    <div className="glass-pill rounded-xl p-2.5 border border-white/5">
      <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`text-lg font-black ${c}`}>{value}</div>
    </div>
  );
}

// ---------- Confidence Dashboard ----------
const CONF_ROWS = [
  ["AI Confidence", 92, "cyan"], ["Detection Accuracy", 97, "emerald"], ["False Positive Risk", 4, "rose"],
  ["Evidence Strength", 88, "cyan"], ["Threat Severity", 74, "amber"], ["Model Agreement", 96, "emerald"],
] as const;
function ConfidenceDashboard() {
  return (
    <Panel title="AI Confidence Dashboard" icon={Eye} subtitle="Model diagnostics & decision quality">
      <div className="space-y-2.5">
        {CONF_ROWS.map(([label, v, tone]) => (
          <div key={label}>
            <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">{label}</span><span className="font-mono text-slate-200">{v}%</span></div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className={`h-full bg-${tone}-400`} style={{ width: `${v}%`, background: tone === "cyan" ? "#22d3ee" : tone === "emerald" ? "#34d399" : tone === "amber" ? "#facc15" : "#f43f5e" }} />
            </div>
          </div>
        ))}
        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 pt-2">7 active models · gemini · gpt · nebula-brain</div>
      </div>
    </Panel>
  );
}

// ---------- System Health ----------
function SystemHealth() {
  const [cpu, setCpu] = useState(42), [mem, setMem] = useState(61), [q, setQ] = useState(128);
  useEffect(() => { const id = setInterval(() => { setCpu((v) => clamp(v + (Math.random() - 0.5) * 12, 10, 90)); setMem((v) => clamp(v + (Math.random() - 0.5) * 6, 20, 92)); setQ((v) => Math.max(0, v + Math.round((Math.random() - 0.5) * 30))); }, 1200); return () => clearInterval(id); }, []);
  return (
    <Panel title="System Health" icon={Cpu} subtitle="Runtime diagnostics">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <HealthTile label="Processing" value={`${cpu.toFixed(0)}%`} bar={cpu} tone="cyan" />
        <HealthTile label="Memory" value={`${mem.toFixed(0)}%`} bar={mem} tone="fuchsia" />
        <HealthTile label="Queue" value={`${q}`} bar={Math.min(100, q / 3)} tone="emerald" />
        <HealthTile label="Scans / min" value="1,428" bar={78} tone="amber" />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        <StatusRow label="Finnhub" ok /> <StatusRow label="Onchain feed" ok />
        <StatusRow label="Threat DB" ok /> <StatusRow label="Model Gateway" ok />
      </div>
    </Panel>
  );
}
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function HealthTile({ label, value, bar, tone }: { label: string; value: string; bar: number; tone: "cyan" | "fuchsia" | "emerald" | "amber" }) {
  const bg = { cyan: "#22d3ee", fuchsia: "#e879f9", emerald: "#34d399", amber: "#facc15" }[tone];
  return (
    <div className="glass-pill rounded-lg p-2.5 border border-white/5">
      <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">{label}</div>
      <div className="text-base font-black text-white">{value}</div>
      <div className="h-1 mt-1 rounded-full bg-white/5 overflow-hidden"><div className="h-full transition-all duration-700" style={{ width: `${bar}%`, background: bg }} /></div>
    </div>
  );
}
function StatusRow({ label, ok }: { label: string; ok?: boolean }) {
  return <div className="flex items-center justify-between glass-pill rounded-lg px-2.5 py-1.5"><span className="text-slate-400">{label}</span><span className={`font-mono ${ok ? "text-emerald-400" : "text-rose-400"}`}>● {ok ? "OK" : "DOWN"}</span></div>;
}

// ---------- Live Intelligence Feed ----------
const FEED_TEMPLATES = [
  { icon: Radio, txt: "New phishing kit detected: 'meta-claim-v3'", tone: "rose" },
  { icon: Globe, txt: "Domain registered · airdrop-safe-{n}.net", tone: "amber" },
  { icon: Database, txt: "Leaked credentials · +{n} rows added to memory", tone: "cyan" },
  { icon: Zap, txt: "Wallet 0x{hex} flagged · pattern match confidence 91%", tone: "rose" },
  { icon: Shield, txt: "Blocked {n} outbound requests to known C2", tone: "emerald" },
  { icon: Activity, txt: "AI reclassified cluster 'moonshot' → HIGH severity", tone: "amber" },
] as const;
function LiveFeed() {
  const [items, setItems] = useState<{ id: number; txt: string; icon: typeof Radio; tone: string; t: string }[]>([]);
  useEffect(() => {
    let id = 0;
    const push = () => {
      const tpl = FEED_TEMPLATES[Math.floor(Math.random() * FEED_TEMPLATES.length)];
      const txt = tpl.txt.replace("{n}", String(Math.floor(Math.random() * 900) + 10)).replace("{hex}", Math.random().toString(16).slice(2, 8));
      setItems((prev) => [{ id: ++id, txt, icon: tpl.icon, tone: tpl.tone, t: new Date().toLocaleTimeString() }, ...prev].slice(0, 8));
    };
    push(); push(); push();
    const iv = setInterval(push, 2200);
    return () => clearInterval(iv);
  }, []);
  return (
    <Panel title="Live Intelligence Feed" icon={Radio} subtitle="Streaming discoveries">
      <div className="space-y-1.5 max-h-72 overflow-hidden">
        {items.map((it, i) => {
          const Icon = it.icon;
          const c = it.tone === "rose" ? "text-rose-400" : it.tone === "amber" ? "text-amber-400" : it.tone === "emerald" ? "text-emerald-400" : "text-cyan-400";
          return (
            <div key={it.id} className="flex items-start gap-2 text-xs glass-pill rounded-lg px-2.5 py-1.5 border border-white/5" style={{ opacity: 1 - i * 0.08, animation: "feedIn 400ms ease" }}>
              <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${c}`} />
              <div className="flex-1 text-slate-200 leading-snug">{it.txt}</div>
              <div className="font-mono text-[10px] text-slate-500 shrink-0">{it.t}</div>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes feedIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}`}</style>
    </Panel>
  );
}

// ---------- Threat Timeline ----------
const TIMELINE = [
  { t: "T-6h", ev: "First observation · domain airdrop-safe.net registered", conf: 34 },
  { t: "T-5h", ev: "TLS fingerprint match with 2024 phishing kit", conf: 58 },
  { t: "T-4h", ev: "Wallet 0xf7c2 receives seed funding from mixer", conf: 66 },
  { t: "T-3h", ev: "Impersonation content copied from official brand", conf: 78 },
  { t: "T-2h", ev: "Cluster linked to APT-Nebula-7 with 88% confidence", conf: 88 },
  { t: "T-1h", ev: "3 additional lookalike domains found (same registrar)", conf: 92 },
  { t: "NOW", ev: "AI recommends: escalate + block · notify subscribers", conf: 96 },
];
function ThreatTimeline() {
  return (
    <Panel title="Threat Timeline" icon={Activity} subtitle="Evolution of a live incident">
      <div className="relative pl-4">
        <div className="absolute left-1.5 top-1 bottom-1 w-px bg-gradient-to-b from-cyan-400/60 via-fuchsia-400/60 to-transparent" />
        <div className="space-y-3">
          {TIMELINE.map((row) => (
            <div key={row.t} className="relative">
              <div className="absolute -left-3 top-1.5 h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400 w-12">{row.t}</span>
                <span className="text-sm text-slate-200 flex-1">{row.ev}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">conf {row.conf}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ---------- AI Memory ----------
const MEMORY = [
  { k: "domain", v: "invest-vault.io", meta: "seen 41 days ago · linked to 3 wallets" },
  { k: "wallet", v: "0xf7c2…a19b", meta: "3 prior rug-pulls · $184k moved" },
  { k: "email", v: "support@moon-claim.help", meta: "used across 12 phishing sites" },
  { k: "phone", v: "+1 415-555-0139", meta: "6 impersonation reports" },
  { k: "domain", v: "airdrop-safe.net", meta: "new · shares TLS fp with 14 sites" },
  { k: "social", v: "@nebula_support", meta: "cloned handle · reported 22×" },
];
function AIMemory() {
  return (
    <Panel title="AI Memory" icon={Database} subtitle="Long-term recall of entities & incidents">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {MEMORY.map((m) => (
          <div key={m.v} className="glass-pill rounded-lg p-2.5 border border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">{m.k}</span>
              <span className="text-sm font-semibold text-slate-100 truncate">{m.v}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">{m.meta}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ---------- Explainability ----------
function Explainability() {
  return (
    <Panel title="AI Explainability" icon={Sparkles} subtitle="Why the brain reached this conclusion">
      <div className="space-y-3 text-sm">
        <ExplainRow label="Conclusion" value="Domain classified MALICIOUS · confidence 92%" tone="rose" />
        <ExplainRow label="Supporting evidence" value="TLS fp reuse (14 sites) · funding from mixer · brand impersonation" />
        <ExplainRow label="Similar prior cases" value="Q3-2024 'yield-vault' cluster · Q1-2025 'metaclaim' incident" />
        <ExplainRow label="Alternative possibility" value="Legitimate rebrand — probability 4% (low, no whois continuity)" tone="amber" />
        <ExplainRow label="Risk factors" value="Financial loss, credential theft, wallet drainer script embedded" />
        <ExplainRow label="Recommended action" value="Escalate to takedown + push subscriber alert" tone="cyan" />
      </div>
    </Panel>
  );
}
function ExplainRow({ label, value, tone }: { label: string; value: string; tone?: "rose" | "amber" | "cyan" }) {
  const c = tone === "rose" ? "text-rose-300" : tone === "amber" ? "text-amber-300" : tone === "cyan" ? "text-cyan-300" : "text-slate-200";
  return (
    <div className="glass-pill rounded-lg p-3 border border-white/5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`text-sm mt-0.5 ${c}`}>{value}</div>
    </div>
  );
}

// ---------- Panel wrapper ----------
function Panel({ title, icon: Icon, subtitle, children }: { title: string; icon: typeof Brain; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl p-4 sm:p-5 border border-white/10 relative">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-white/5 grid place-items-center border border-white/10">
            <Icon className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-tight">{title}</div>
            {subtitle && <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{subtitle}</div>}
          </div>
        </div>
        <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> live</span>
      </header>
      {children}
    </section>
  );
}

// ---------- Particles ----------
function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    let w = c.width = window.innerWidth, h = c.height = window.innerHeight, raf = 0;
    const pts = Array.from({ length: 60 }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25 }));
    const onR = () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; };
    window.addEventListener("resize", onR);
    const loop = () => {
      ctx.clearRect(0, 0, w, h);
      pts.forEach(p => { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; });
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 130) { ctx.strokeStyle = `rgba(34,211,238,${(1 - d / 130) * 0.15})`; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
        ctx.fillStyle = "rgba(34,211,238,0.55)"; ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 1.2, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onR); };
  }, []);
  return <canvas ref={ref} className="fixed inset-0 pointer-events-none opacity-40" />;
}

function Footer() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] text-slate-500 py-6 font-mono uppercase tracking-widest">
      <Link to="/" className="hover:text-cyan-400">← Back to Terminal</Link>
      <span className="text-slate-700">·</span>
      <span>Alpha Brain · Intelligence Center · Simulated live view</span>
    </div>
  );
}
