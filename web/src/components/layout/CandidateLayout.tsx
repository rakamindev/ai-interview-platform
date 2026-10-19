import { Outlet } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";

export default function CandidateLayout() {
  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-[#F8FAFC]">
      <header className="border-b border-border bg-white sticky top-0 z-50 shadow-sm shadow-black/[0.02]">
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 h-14 flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-muted"
            aria-hidden
          >
            <LayoutDashboard className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">
              Rakamin AI Interview
            </p>
            <p className="text-[11px] text-muted-foreground leading-none hidden sm:block">
              Candidate session
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full max-w-2xl mx-auto min-h-0">
        <Outlet />
      </main>
    </div>
  );
}
