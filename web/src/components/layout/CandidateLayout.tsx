import { Outlet } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import BrandMark from "@/components/layout/BrandMark";

export default function CandidateLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background bg-page-wash bg-no-repeat">
      {/* Minimal header — no nav, so the candidate can't wander off mid-interview */}
      <header className="px-4 pt-4">
        <div className="mx-auto flex h-12 max-w-2xl items-center rounded-full border border-white/70 bg-card/80 px-3 shadow-sm backdrop-blur">
          <BrandMark />
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <ErrorBoundary fullScreen={false}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
