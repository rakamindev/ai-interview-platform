import { Outlet } from "react-router-dom";
import { RakaminLogo } from "@/components/ui/RakaminLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ShieldCheck } from "lucide-react";

export default function CandidateLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
      {/* Candidate Focused Header */}
      <header className="border-b border-border/80 bg-card/90 backdrop-blur-md sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RakaminLogo size="sm" subtitle="Candidate Assessment Room" />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-xl border border-border/60">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span className="font-medium">Privasi Terlindungi (UU PDP)</span>
            </div>
            <ThemeToggle variant="button" />
          </div>
        </div>
      </header>

      {/* Main Candidate Interaction View */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
