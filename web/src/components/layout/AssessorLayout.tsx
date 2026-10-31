import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ClipboardList, Briefcase, LogOut } from "lucide-react";
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
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header */}
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto w-full px-3 sm:px-4 py-2 sm:h-14 sm:py-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <Link to="/assessments" className="flex items-center gap-2 min-w-0 py-1">
              <LayoutDashboard className="h-5 w-5 shrink-0 text-primary" />
              <span className="font-semibold text-sm truncate">Rakamin AI Interview</span>
            </Link>
            <div className="flex items-center gap-1.5 shrink-0 sm:hidden">
              {tenant.name && (
                <span className="max-w-[34vw] truncate text-[11px] text-muted-foreground border rounded-full px-2 py-0.5">
                  {tenant.name}
                </span>
              )}
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleLogout} aria-label="Logout">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <nav className="grid grid-cols-2 gap-1 w-full sm:flex sm:w-auto sm:items-center">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                to={href}
                className={cn(
                  "flex items-center justify-center sm:justify-start gap-1.5 min-h-10 px-3 py-2 rounded-md text-sm transition-colors",
                  location.pathname.startsWith(href)
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="hidden sm:flex items-center gap-3 shrink-0">
            {tenant.name && (
              <span className="max-w-48 truncate text-xs text-muted-foreground border rounded-full px-2.5 py-0.5">
                Tenant: {tenant.name}
              </span>
            )}
            <Button variant="ghost" size="sm" className="min-h-10" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 w-full min-w-0 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}
