import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { ClipboardList, Briefcase, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="min-h-screen flex flex-col bg-slate-50/60 dark:bg-slate-950 selection:bg-teal-500 selection:text-white font-sans antialiased">
      {/* Premium Frozen Glass Top Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/75 dark:bg-slate-900/75 border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs transition-all">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link to="/assessments" className="flex items-center gap-3.5 hover:opacity-90 transition-all">
              <img
                src="/rakamin-logo.png"
                alt="Rakamin Logo"
                className="h-8 object-contain"
              />
              <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">AI Interview</span>
                <span className="text-[11px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/80">
                  Admin
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-2">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = location.pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    to={href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150",
                      isActive
                        ? "bg-teal-600 text-white shadow-md shadow-teal-500/20"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100"
                    )}
                  >
                    <Icon className={cn("h-4.5 w-4.5", isActive ? "text-white" : "text-slate-400")} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {tenant.name && (
              <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-full px-3.5 py-1.5 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                <span className="text-slate-500 dark:text-slate-400 font-normal">Tenant:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{tenant.name}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-3.5 py-2 rounded-xl"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}


