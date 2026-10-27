import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ClipboardList, Briefcase, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { m } from "motion/react";
import { useLocation } from "react-router-dom";

const navItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
];

/**
 * Provides the main application shell for assessors, including navigation links, tenant identification, and logout controls.
 * Use it as the layout route wrapper for authenticated assessor pages such as assessments and vacancies.
 */
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
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header */}
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-6 min-w-0">
            <Link to="/assessments" className="flex items-center gap-2 shrink-0" aria-label="Rakamin AI Interview">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <span className="hidden md:inline font-semibold text-sm">Rakamin AI Interview</span>
            </Link>
            <nav className="flex items-center gap-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = location.pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    to={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-1.5 px-2.5 sm:px-3 min-h-11 sm:min-h-9 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {/* Shared-layout pill: slides to the section you switched to, so the change of place is felt */}
                    {active && <m.span layoutId="nav-active" className="absolute inset-0 rounded-md bg-primary/10" aria-hidden />}
                    <Icon className="relative h-4 w-4" aria-hidden />
                    <span className="relative">{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {tenant.name && (
              <span className="hidden sm:inline text-xs text-muted-foreground border rounded-full px-2.5 py-0.5">
                Tenant: {tenant.name}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Logout" className="min-h-11 min-w-11 sm:min-h-9 sm:min-w-0">
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
