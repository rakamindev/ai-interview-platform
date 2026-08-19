import { Outlet } from "react-router-dom";

export default function CandidateLayout() {
  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-background">
      {/* Minimal header — no nav */}
      <header className="border-b bg-white">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center">
          <span className="font-semibold text-sm text-muted-foreground">AI Interview</span>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
