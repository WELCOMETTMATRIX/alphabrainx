import { useEffect, useState } from "react";

export type CookieCategory = "essential" | "functional" | "diagnostics";

export type CookiePrefs = {
  essential: true;
  functional: boolean;
  diagnostics: boolean;
  updatedAt: string;
  version: number;
};

const KEY = "ab_cookie_consent_v1";
const VERSION = 1;

export function readCookiePrefs(): CookiePrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as CookiePrefs;
    if (!p || p.version !== VERSION) return null;
    return { ...p, essential: true };
  } catch {
    return null;
  }
}

export function hasCookieConsent(cat: CookieCategory): boolean {
  if (cat === "essential") return true;
  const p = readCookiePrefs();
  return p ? Boolean(p[cat]) : false;
}

function writePrefs(functional: boolean, diagnostics: boolean): CookiePrefs {
  const prefs: CookiePrefs = {
    essential: true,
    functional,
    diagnostics,
    updatedAt: new Date().toISOString(),
    version: VERSION,
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage blocked — session-only consent */
  }
  window.dispatchEvent(new CustomEvent("ab:cookie-prefs", { detail: prefs }));
  return prefs;
}

/** Opens the settings modal from anywhere (footer links, policy pages). */
export function openCookieSettings() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("ab:open-cookie-settings"));
}

const ROWS: { id: CookieCategory; title: string; body: string; locked?: boolean }[] = [
  {
    id: "essential",
    title: "Strictly necessary",
    body:
      "Keeps the terminal usable: your consent choice, active theme and the security/rate-limit state of server calls. Cannot be disabled.",
    locked: true,
  },
  {
    id: "functional",
    title: "Functional storage",
    body:
      "Local storage for your watchlist, price alerts, alert sound setting, layout and last selected asset. Stays on this device — never uploaded.",
  },
  {
    id: "diagnostics",
    title: "Diagnostics",
    body:
      "Sends anonymous crash and runtime-error reports so broken panels can be fixed. No profiling, no advertising, no third-party ad networks.",
  },
];

export function CookieConsent() {
  const [ready, setReady] = useState(false);
  const [banner, setBanner] = useState(false);
  const [modal, setModal] = useState(false);
  const [functional, setFunctional] = useState(true);
  const [diagnostics, setDiagnostics] = useState(true);

  useEffect(() => {
    const p = readCookiePrefs();
    if (p) {
      setFunctional(p.functional);
      setDiagnostics(p.diagnostics);
    } else {
      setBanner(true);
    }
    setReady(true);
    const open = () => setModal(true);
    window.addEventListener("ab:open-cookie-settings", open);
    return () => window.removeEventListener("ab:open-cookie-settings", open);
  }, []);

  if (!ready) return null;

  const save = (f: boolean, d: boolean) => {
    writePrefs(f, d);
    setFunctional(f);
    setDiagnostics(d);
    setBanner(false);
    setModal(false);
  };

  return (
    <>
      {banner && !modal && (
        <div className="fixed inset-x-0 bottom-0 z-[10000] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#080c17]/95 p-4 shadow-2xl backdrop-blur-xl">
            <p className="text-[13px] leading-relaxed text-slate-300">
              <strong className="text-white">Cookies &amp; local storage.</strong> Alpha Brain runs no ad
              networks and no third-party trackers. We only need essential storage to work; functional
              storage (watchlist, alerts) and anonymous diagnostics are optional.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => save(true, true)}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-black hover:bg-cyan-400"
              >
                Accept all
              </button>
              <button
                onClick={() => save(false, false)}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
              >
                Reject non-essential
              </button>
              <button
                onClick={() => setModal(true)}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
              >
                Manage categories
              </button>
              <a
                href="/cookies"
                className="self-center px-1 text-[11px] font-mono uppercase tracking-widest text-cyan-400 hover:text-cyan-300"
              >
                Cookie policy
              </a>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[10001] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#080c17] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-bold text-white">Cookie settings</h2>
              <button
                onClick={() => setModal(false)}
                className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {ROWS.map((r) => {
                const on = r.id === "essential" ? true : r.id === "functional" ? functional : diagnostics;
                const set = r.id === "functional" ? setFunctional : setDiagnostics;
                return (
                  <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-white">{r.title}</span>
                      <button
                        disabled={r.locked}
                        onClick={() => !r.locked && set(!on)}
                        aria-pressed={on}
                        className={`h-6 w-11 shrink-0 rounded-full border transition-colors ${
                          on ? "border-cyan-400/50 bg-cyan-500/70" : "border-white/15 bg-white/10"
                        } ${r.locked ? "opacity-60" : ""}`}
                      >
                        <span
                          className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                            on ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{r.body}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => save(functional, diagnostics)}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-black hover:bg-cyan-400"
              >
                Save choices
              </button>
              <button
                onClick={() => save(true, true)}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
              >
                Accept all
              </button>
              <button
                onClick={() => save(false, false)}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
              >
                Reject non-essential
              </button>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              You can reopen this panel any time from the “Cookies” link in the footer. Read the full{" "}
              <a href="/cookies" className="text-cyan-400 underline">
                Cookie Policy
              </a>
              .
            </p>
          </div>
        </div>
      )}
    </>
  );
}
