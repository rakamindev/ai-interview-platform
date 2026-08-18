import { Outlet } from "react-router-dom";

export default function CandidateLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[hsl(184_20%_98%)]">
      <header className="border-b border-border/80 bg-white/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <span className="h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="font-semibold text-sm text-foreground">AI Interview</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
