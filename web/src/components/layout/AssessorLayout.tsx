import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import ErrorBoundary from "@/components/ErrorBoundary";
import BrandMark from "@/components/layout/BrandMark";
import { ClipboardList, Briefcase, LogOut, Building2 } from "lucide-react";
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
    <div className="min-h-screen flex flex-col bg-background bg-page-wash bg-no-repeat">
      <header className="sticky top-0 z-40 px-4 pt-4">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-full border border-white/70 bg-card/80 pl-4 pr-2 shadow-[0_8px_30px_-12px_rgb(33_102_111/0.25)] backdrop-blur">
          <div className="flex min-w-0 items-center gap-4">
            <Link to="/assessments" className="shrink-0" aria-label="Rakamin AI Interview home">
              <BrandMark compact />
            </Link>
            <nav className="flex items-center gap-1 rounded-full bg-muted p-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = location.pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    to={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-card font-medium text-primary shadow-sm"
                        : "text-muted-foreground hover:text-primary",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only">{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {tenant.name && (
              <span className="hidden max-w-[12rem] items-center gap-1.5 truncate rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground lg:flex">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Tenant: {tenant.name}</span>
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut />
              <span className="sr-only sm:not-sr-only">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {/* Keyed by path: a crash stays inside this page, and navigating away recovers. */}
        <ErrorBoundary key={location.pathname} fullScreen={false}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
