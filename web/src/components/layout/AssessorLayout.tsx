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
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b bg-white">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2 sm:flex sm:h-16 sm:justify-between sm:gap-0 sm:px-4 sm:py-0">
          <div className="contents sm:flex sm:items-center sm:gap-6">
            <Link to="/assessments" className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 sm:flex-none">
              <LayoutDashboard className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate text-[13px] font-semibold sm:text-sm">Rakamin AI Interview</span>
            </Link>
            <nav aria-label="Main navigation" className="col-span-2 row-start-2 grid w-full min-w-0 grid-cols-2 items-center gap-1 sm:row-auto sm:flex sm:w-auto">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  aria-current={location.pathname.startsWith(href) ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-sm transition-colors sm:flex-none sm:justify-start sm:px-3",
                    location.pathname.startsWith(href)
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="col-start-2 row-start-1 flex items-center justify-self-end gap-1 sm:gap-3">
            {tenant.name && (
              <span className="max-w-[28vw] truncate rounded-full border bg-background px-2 py-1 text-xs text-muted-foreground sm:max-w-[18rem] sm:px-3">
                {tenant.name}
              </span>
            )}
            <Button variant="ghost" size="sm" className="h-11 w-11 px-0 sm:w-auto sm:px-3" onClick={handleLogout} aria-label="Log out">
              <LogOut className="mr-0 h-4 w-4 sm:mr-1.5" />
              <span className="sr-only sm:not-sr-only">Log out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
