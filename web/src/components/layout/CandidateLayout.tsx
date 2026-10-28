import { Outlet } from "react-router-dom";

export default function CandidateLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center px-4 sm:px-6">
          <span className="text-sm font-semibold tracking-tight text-foreground">AI Interview</span>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}