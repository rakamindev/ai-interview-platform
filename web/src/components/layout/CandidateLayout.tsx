import { Outlet } from "react-router-dom";

export default function CandidateLayout() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="sticky top-0 z-30 h-14 shrink-0 border-b bg-white">
        <div className="mx-auto flex h-full w-full max-w-5xl items-center px-4">
          <span className="font-semibold text-sm text-foreground">Rakamin AI Interview</span>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
