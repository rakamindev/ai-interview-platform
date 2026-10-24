import { Outlet } from "react-router-dom";
import { Sparkles, ShieldCheck } from "lucide-react";

export default function CandidateLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100 antialiased font-sans selection:bg-[#01959f] selection:text-white">
      {/* Minimal sleek interview header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-teal flex items-center justify-center text-white shadow-sm shadow-teal-500/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                Rakamin <span className="text-[#01959f]">AI Interview</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/80 border border-slate-700/60 rounded-full px-3 py-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Secure & Encrypted</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
