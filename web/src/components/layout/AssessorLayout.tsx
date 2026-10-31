import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ClipboardList,
  Briefcase,
  LogOut,
} from "lucide-react";
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
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_110px] items-center gap-x-3 gap-y-2 px-4 py-2 sm:flex sm:flex-wrap sm:gap-4">
          <Link
            to="/assessments"
            className="flex min-h-11 min-w-0 items-center gap-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <LayoutDashboard
              className="h-5 w-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="text-xs font-semibold sm:text-sm">
              Rakamin AI Interview
            </span>
          </Link>
          <nav
            className="col-start-1 row-start-2 flex flex-wrap items-center gap-1"
            aria-label="Assessor navigation"
          >
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                to={href}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 rounded-md px-1.5 py-2 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-3 sm:text-sm",
                  location.pathname.startsWith(href)
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="hidden h-4 w-4 sm:block" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
          {tenant.name && (
            <span className="col-start-2 row-start-1 break-words rounded-md border px-2 py-1 text-[11px] leading-4 text-slate-600 sm:ml-auto sm:text-xs">
              Tenant: {tenant.name}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="col-start-2 row-start-2 min-h-11 justify-self-end focus-visible:ring-2"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </Button>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
