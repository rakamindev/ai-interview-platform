import { Outlet } from "react-router-dom";
import rakaminLogo from "@/assets/rakamin-logo-transparent.png";

export default function CandidateLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Minimal header — no nav */}
      <header className="border-b bg-white">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center gap-2">
          <img src={rakaminLogo} alt="Rakamin" className="h-6 w-auto object-contain" />
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <span className="font-medium text-xs sm:text-sm text-muted-foreground">AI Interview</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
