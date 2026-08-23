import { Outlet } from "react-router-dom";
import { m } from "@/paraglide/messages.js";
import { LayoutDashboard } from "lucide-react";

export default function CandidateLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Minimal header — no nav */}
      <header className="border-b bg-background">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">{m.nav_brand()}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
