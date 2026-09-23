import { Outlet } from "react-router-dom";

export default function CandidateLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-foreground/10 bg-card/80">
        <div className="max-w-xl mx-auto px-4 h-12 flex items-center">
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">
            Rakamin <span className="text-primary">AI Interview</span>
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
