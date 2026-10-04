import { Outlet } from "react-router-dom";

export default function CandidateLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Minimal header — no nav */}
      <header className="border-b bg-background">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/rakamin-logo.png"
              alt="Rakamin"
              className="h-6 w-auto object-contain"
            />
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              AI Interview
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
