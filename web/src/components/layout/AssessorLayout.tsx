import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { LayoutDashboard, ClipboardList, Briefcase, LogOut, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

const navItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
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
    <div className="min-h-screen flex flex-col bg-[#fafcfa] text-slate-900 relative overflow-x-hidden selection:bg-emerald-500 selection:text-white">
      {/* ── Layer 1: Ambient Emerald Aura Lighting ── */}
      {/* Top Overhead Spotlight */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[550px] bg-gradient-to-b from-emerald-400/15 via-teal-300/10 to-transparent rounded-full blur-[140px] pointer-events-none" />

      {/* Side Ambient Glow Orbs */}
      <div className="fixed -bottom-24 -left-24 w-[600px] h-[600px] bg-emerald-500/8 rounded-full blur-[160px] pointer-events-none" />
      <div className="fixed top-1/3 -right-28 w-[550px] h-[550px] bg-teal-400/8 rounded-full blur-[150px] pointer-events-none" />

      {/* ── Layer 2: Concentric Radar / Tech Rings ── */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full border border-emerald-500/10 pointer-events-none" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[980px] h-[980px] rounded-full border border-dashed border-emerald-400/[0.12] pointer-events-none" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1350px] h-[1350px] rounded-full border border-emerald-500/[0.06] pointer-events-none" />

      {/* ── Layer 3: Precision Dot-Matrix Grid with Vignette ── */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(16, 185, 129, 0.15) 1.2px, transparent 1.2px)`,
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 85% 75% at 50% 45%, #000 35%, transparent 95%)",
          WebkitMaskImage: "radial-gradient(ellipse 85% 75% at 50% 45%, #000 35%, transparent 95%)",
        }}
      />

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 border-b border-emerald-500/15 backdrop-blur-xl bg-white/85 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.06)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6 sm:gap-8">
            <Link to="/assessments" className="flex items-center gap-3 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 border border-emerald-400/40 flex items-center justify-center text-white shadow-[0_2px_12px_rgba(16,185,129,0.35)] group-hover:scale-105 transition-transform">
                <LayoutDashboard className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-tight text-slate-900">
                    Rakamin AI Interview
                  </span>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-emerald-50 border border-emerald-300 text-emerald-800">
                    Assessor Hub
                  </span>
                </div>
              </div>
            </Link>

            <nav className="flex items-center gap-1.5">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = location.pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    to={href}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all",
                      isActive
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold shadow-sm"
                        : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", isActive ? "text-emerald-600" : "text-slate-400")} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {tenant.name && (
              <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100/90 border border-slate-200/80 rounded-full px-3 py-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {tenant.name}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer font-medium"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 relative z-10">
        <Outlet />
      </main>
    </div>
  );
}
