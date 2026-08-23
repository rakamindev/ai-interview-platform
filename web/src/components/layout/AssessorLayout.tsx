import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { clearAuth } from "@/stores/authAtom";
import { stopRefreshTimer } from "@/services/api";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ClipboardList, Briefcase, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { m } from "@/paraglide/messages.js";
import { authApi } from "@/services/auth";

const navItems = [
  { href: "/assessments", label: m.nav_assessments(), icon: ClipboardList },
  { href: "/vacancies", label: m.nav_vacancies(), icon: Briefcase }
];

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort — clear local state regardless
    }
    stopRefreshTimer();
    clearAuth();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header */}
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/assessments" className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">{m.nav_brand()}</span>
            </Link>
            <nav className="flex items-center gap-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                    location.pathname.startsWith(href)
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {tenant.name && (
              <span className="text-xs text-muted-foreground border rounded-full px-2.5 py-0.5">
                {m.nav_tenant({ name: tenant.name })}
              </span>
            )}
            <ThemeToggle />
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1.5" />
              {m.nav_logout()}
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
