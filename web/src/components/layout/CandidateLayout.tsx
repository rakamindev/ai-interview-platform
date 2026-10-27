import { Outlet } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";
import { ShieldCheck, Lock } from "lucide-react";

export default function CandidateLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900 antialiased selection:bg-teal-100 selection:text-teal-900">
      {/* Top Header */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <BrandLogo size="sm" />
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-full">
            <Lock className="h-3 w-3 text-teal-700" />
            <span className="hidden sm:inline">Secure Session • UU PDP Verified</span>
            <span className="sm:hidden">Secure Session</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {/* Candidate Privacy Footer */}
      <footer className="border-t border-slate-100 py-4 text-center text-xs text-slate-600">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span>Sesi wawancara dilindungi UU PDP No. 27/2022. Rekaman audio hanya diakses oleh tim hiring resmi.</span>
        </div>
      </footer>
    </div>
  );
}
