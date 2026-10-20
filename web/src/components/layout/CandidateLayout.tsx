import { Outlet } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";

export default function CandidateLayout() {
  return (
    <div className="min-h-screen bg-muted/20 text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <LayoutDashboard className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold tracking-tight">AI Interview</span>
          </div>
        </div>
      </header>

      <main className="flex min-h-[calc(100dvh-4rem)] flex-col">
        <Outlet />
      </main>
    </div>
  );
}
