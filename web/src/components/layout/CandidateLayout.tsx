import { Outlet } from "react-router-dom";

export default function CandidateLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Minimal header — no nav */}
      <header className="border-b bg-white">
        <div className="w-full max-w-2xl mx-auto px-4 h-12 flex items-center gap-2">
          <img src="/logo.png" alt="Rakamin Logo" className="h-5 w-5 object-contain" />
          <span className="font-semibold text-sm text-foreground">Rakamin AI Interview</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
