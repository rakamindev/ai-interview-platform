import { useLocation } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutDashboard } from "lucide-react";
import { shellForPath } from "@/lib/routeShell";

/** Default silhouette — mirrors `AssessorLayout` (top nav + wide content). */
function AssessorSkeleton() {
  return (
    <div
      data-testid="branded-skeleton-assessor"
      className="min-h-screen flex flex-col bg-background"
    >
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Rakamin AI Interview</span>
          </div>
          <div data-testid="assessor-nav" className="flex items-center gap-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-24" />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="space-y-4 max-w-2xl mx-auto">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </main>
    </div>
  );
}

/** Auth silhouette — mirrors `AuthShell` (two-column teal split + centered form). */
function AuthSkeleton() {
  return (
    <div data-testid="branded-skeleton-auth" className="min-h-screen lg:grid lg:grid-cols-2">
      <aside className="hidden bg-primary lg:flex lg:flex-col lg:p-12">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-14 bg-white/25" />
          <Skeleton className="h-8 w-40 bg-white/25" />
        </div>
        <Skeleton className="mt-10 h-16 w-72 bg-white/25" />
      </aside>

      <main className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex items-center justify-center gap-3 lg:hidden">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-7 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </main>
    </div>
  );
}

/** Interview silhouette — mirrors `CandidateLayout` (minimal header + narrow content). */
function InterviewSkeleton() {
  return (
    <div
      data-testid="branded-skeleton-interview"
      className="min-h-screen flex flex-col bg-background"
    >
      <header className="border-b bg-white">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center">
          <span className="font-semibold text-sm text-muted-foreground">AI Interview</span>
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        <div className="max-w-xl mx-auto w-full px-4 py-8 space-y-6">
          <div className="text-center space-y-2">
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-24 mx-auto" />
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </main>
    </div>
  );
}

/**
 * Route-aware loading fallback. Picks a silhouette that matches the shell being
 * loaded so the Suspense fallback doesn't flash a mismatched layout.
 */
export default function BrandedSkeleton() {
  const { pathname } = useLocation();
  const shell = shellForPath(pathname);

  if (shell === "auth") return <AuthSkeleton />;
  if (shell === "interview") return <InterviewSkeleton />;
  return <AssessorSkeleton />;
}
