import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ClipboardList, Briefcase, LogOut } from "lucide-react";
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
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-6">
            <Link to="/assessments" className="flex min-w-0 shrink items-center gap-2">
              <LayoutDashboard className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate text-sm font-semibold">Rakamin AI Interview</span>
            </Link>
            <nav aria-label="Main navigation" className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  aria-current={location.pathname.startsWith(href) ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors sm:gap-1.5 sm:px-3 sm:text-sm",
                    location.pathname.startsWith(href)
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden min-[390px]:inline">{label}</span>
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            {tenant.name && (
              <span className="hidden max-w-40 truncate rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground md:inline-block">
                Tenant: {tenant.name}
              </span>
            )}
            <Button variant="ghost" size="sm" className="h-9 px-2 sm:px-3" onClick={handleLogout} aria-label="Logout">
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}
