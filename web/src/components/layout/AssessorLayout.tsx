import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ClipboardList, Briefcase, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import { isFitGapDemoEnabled } from "@/lib/demoMode";

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
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header */}
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 min-h-14 py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-1">
            <Link to="/assessments" className="flex min-h-10 items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <span className="hidden font-semibold text-sm sm:inline">Rakamin AI Interview</span>
            </Link>
            <nav className="flex items-center gap-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  aria-label={label}
                  title={label}
                  className={cn(
                    "flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-md px-2 text-sm transition-colors sm:justify-start sm:px-3 sm:py-1.5",
                    location.pathname.startsWith(href)
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            {tenant.name && (
              <span className="hidden max-w-48 truncate rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground sm:inline-block">
                Tenant: {tenant.name}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="min-h-10 min-w-10 px-2 sm:px-3"
              onClick={handleLogout}
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="mr-0 h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {isFitGapDemoEnabled() && (
          <div role="status" className="mb-4 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Demo mode — all displayed candidate and assessment data is fictional.
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
