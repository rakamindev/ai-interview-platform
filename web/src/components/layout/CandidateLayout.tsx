import { Outlet } from "react-router-dom";
import PageLoader from "@/components/common/PageLoader";

export default function CandidateLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      <PageLoader />
      {/* Brand accent gradient bar */}
      <div className="h-[3px] bg-gradient-to-r from-[#01959f] via-teal-400 to-[#fbc036] w-full" />

      {/* Minimal header matching AssessorLayout styling */}
      <header className="border-b border-slate-200/90 bg-white sticky top-0 z-50 shadow-xs">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            <img
              src="/images/rakamin-logo.png"
              alt="Rakamin"
              className="h-[18px] sm:h-[19px] w-auto object-contain shrink-0"
            />
            <div className="hidden sm:block h-3.5 sm:h-4 w-[1.5px] bg-slate-300 shrink-0" />
            <span className="hidden sm:flex text-[15px] font-bold text-slate-800 tracking-tight whitespace-nowrap leading-none items-center translate-y-[1px]">
              Interactive&nbsp;AI&nbsp;<span className="font-extrabold text-[#01959f]">Interview</span><span className="hidden md:inline">&nbsp;Session</span>
            </span>
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-[#01959f] bg-teal-50/80 px-2.5 sm:px-3 py-1 rounded-full border border-teal-200/70 shadow-2xs flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#01959f] animate-pulse" />
            <span className="hidden sm:inline">Secure Candidate Portal</span>
            <span className="sm:hidden">Portal Kandidat</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
