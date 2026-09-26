import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import BottomNav from "./BottomNav";
import {
  ClipboardList,
  Briefcase,
  Users,
  LogOut,
  Building2,
  Bot,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

const navItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
];

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70">
      {/* ── Desktop Top Navbar ── */}
      <header className="hidden md:flex h-16 border-b border-slate-200/80 bg-white/85 backdrop-blur-md sticky top-0 z-40 shadow-2xs transition-all">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between w-full">
          
          {/* Left: Brand Logo & Segmented Nav */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link to="/assessments" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200/90 shadow-2xs group-hover:scale-105 transition-all overflow-hidden p-1">
                <img
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSZMs7hB5lSlMie7MpqlulgL59oYf7CwmvIE6wBr3pzdkKnZEyacEf8t5w&s=10"
                  alt="Rakamin Logo"
                  className="h-full w-full object-contain rounded-lg"
                />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-base tracking-tight text-slate-900">
                  Rakamin
                </span>
                <span className="font-semibold text-base tracking-tight text-primary flex items-center gap-1">
                  AI Interview
                </span>
              </div>
            </Link>

            {/* Segmented Nav Pill Container */}
            <nav className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/60 shadow-2xs">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = location.pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    to={href}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm transition-all duration-150",
                      isActive
                        ? "bg-white text-slate-900 font-semibold shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-slate-500")} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Tenant Pill & Logout */}
          <div className="flex items-center gap-3.5">
            {tenant.name && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100/80 border border-slate-200/80 px-3 py-1.5 rounded-full shadow-2xs">
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                <span>{tenant.name}</span>
              </div>
            )}

            <div className="h-4 w-px bg-slate-200" />

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50/80 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-500 hover:text-rose-600" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Sleek Top Bar ── */}
      <header className="flex md:hidden items-center justify-between px-4 h-14 border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-40 shadow-2xs">
        <Link to="/assessments" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-200/90 shadow-2xs overflow-hidden p-1">
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSZMs7hB5lSlMie7MpqlulgL59oYf7CwmvIE6wBr3pzdkKnZEyacEf8t5w&s=10"
              alt="Rakamin Logo"
              className="h-full w-full object-contain rounded-lg"
            />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-bold text-sm text-slate-900">Rakamin</span>
            <span className="font-semibold text-sm text-primary">AI</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {tenant.name && (
            <div className="flex items-center gap-1 text-[11px] text-slate-700 border border-slate-200/80 rounded-full px-2.5 py-1 bg-slate-100/80 font-medium max-w-[130px] truncate shadow-2xs">
              <Building2 className="h-3 w-3 text-slate-500 shrink-0" />
              <span className="truncate">{tenant.name}</span>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="h-8 w-8 rounded-full bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 flex items-center justify-center transition-colors active:scale-95 cursor-pointer shadow-2xs"
            aria-label="Logout"
            title="Logout"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ── Page Content ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 pb-24 md:pb-8">
        <Outlet />
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <BottomNav />
    </div>
  );
}
