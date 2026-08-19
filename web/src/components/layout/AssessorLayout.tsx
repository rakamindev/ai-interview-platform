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
        <div className="max-w-7xl mx-auto w-full px-3 sm:px-4">
          <div className="min-h-12 flex items-center justify-between gap-3 sm:h-14">
            <div className="flex min-w-0 items-center gap-3 sm:gap-6">
              <Link to="/assessments" className="flex shrink-0 items-center gap-2">
                <LayoutDashboard className="h-5 w-5 shrink-0 text-primary" />
                <span className="font-semibold text-sm leading-tight">
                  <span className="sm:hidden">Rakamin AI</span>
                  <span className="hidden sm:inline">Rakamin AI Interview</span>
                </span>
              </Link>
              <nav className="hidden items-center gap-1 sm:flex">
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
            <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
              {tenant.name && (
                <span className="min-w-0 max-w-[9rem] truncate rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground sm:max-w-[18rem]">
                  Tenant: {tenant.name}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                aria-label="Logout"
                title="Logout"
                className="h-8 w-8 px-0 sm:w-auto sm:px-3"
              >
                <LogOut className="h-4 w-4 sm:mr-1.5" />
                <span className="sr-only sm:not-sr-only">Logout</span>
              </Button>
            </div>
          </div>
          <nav className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1 mb-2 sm:hidden">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                to={href}
                className={cn(
                  "flex min-w-0 items-center justify-center gap-1.5 rounded-sm px-2 py-2 text-sm transition-colors",
                  location.pathname.startsWith(href)
                    ? "bg-white text-primary shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 py-4 sm:px-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}
