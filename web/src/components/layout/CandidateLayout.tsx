import { Outlet } from "react-router-dom";
import { Sparkles, ShieldCheck, Activity } from "lucide-react";

export default function CandidateLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fafcfa] text-slate-900 relative overflow-x-hidden selection:bg-emerald-500 selection:text-white">
      {/* ── Layer 1: Ambient Emerald Aura Lighting ── */}
      {/* Top Overhead Spotlight */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-emerald-400/15 via-teal-300/10 to-transparent rounded-full blur-[140px] pointer-events-none" />

      {/* Side Ambient Glow Orbs */}
      <div className="fixed -bottom-24 -left-24 w-[600px] h-[600px] bg-emerald-500/8 rounded-full blur-[160px] pointer-events-none" />
      <div className="fixed top-1/3 -right-28 w-[550px] h-[550px] bg-teal-400/8 rounded-full blur-[150px] pointer-events-none" />

      {/* ── Layer 2: Concentric Radar / Tech Rings ── */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full border border-emerald-500/10 pointer-events-none" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[980px] h-[980px] rounded-full border border-dashed border-emerald-400/[0.12] pointer-events-none" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1350px] h-[1350px] rounded-full border border-emerald-500/[0.06] pointer-events-none" />

      {/* ── Layer 3: Precision Dot-Matrix Grid with Vignette ── */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(16, 185, 129, 0.15) 1.2px, transparent 1.2px)`,
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 85% 75% at 50% 45%, #000 35%, transparent 95%)",
          WebkitMaskImage: "radial-gradient(ellipse 85% 75% at 50% 45%, #000 35%, transparent 95%)",
        }}
      />

      {/* ── Layer 4: Modern Floating Glass Header ── */}
      <header className="sticky top-0 z-40 border-b border-emerald-500/15 backdrop-blur-xl bg-white/80 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.06)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand & Portal Title */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-[0_2px_12px_rgba(16,185,129,0.35)]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-slate-900">
                  Rakamin AI Interview
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase bg-emerald-50 border border-emerald-300/60 text-emerald-700">
                  Candidate Portal
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-normal">
                Intelligent Voice Assessment Session
              </span>
            </div>
          </div>

          {/* Right Status Badges */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-800 font-medium shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Voice Engine Active</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="hidden md:inline">256-Bit Encrypted</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Layer 5: Main Content Container ── */}
      <main className="flex-1 flex flex-col relative z-10">
        <Outlet />
      </main>

      {/* ── Layer 6: Understated Technical Footer ── */}
      <footer className="py-6 border-t border-emerald-500/10 text-center text-xs text-slate-500 relative z-10 bg-white/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-800/60">
            <Activity className="h-3.5 w-3.5 text-emerald-600" />
            <span>SESSION // VOICE_ASSESSMENT_V1</span>
          </div>
          <p className="text-slate-500 text-[11px]">
            © 2026 Rakamin AI Assessment Platform. Confidential & Proprietary.
          </p>
        </div>
      </footer>
    </div>
  );
}
