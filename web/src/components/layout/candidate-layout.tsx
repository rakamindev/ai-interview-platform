import { Outlet } from "@tanstack/react-router";

export function CandidateLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Minimal header — no nav */}
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="mx-auto flex h-12 max-w-2xl items-center px-4">
          <span className="flex items-center gap-1.5">
            <img src="/rakamin.png" alt="Rakamin" className="size-6" />
            <span className="text-lg font-semibold tracking-tight text-foreground">AI Interview</span>
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
