import { LayoutDashboard } from "lucide-react";
import { Outlet } from "react-router-dom";

export default function CandidateLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Minimal header — no nav */}
      <header className="border-b bg-white">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center">

          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-black" />
            <span className="font-bold text-zinc-900 tracking-tight text-lg">
              Rakamin<span className="text-zinc-500 font-normal"> AI Interview</span>
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
