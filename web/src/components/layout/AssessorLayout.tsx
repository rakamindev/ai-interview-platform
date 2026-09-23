import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/assessments", label: "Assessments" },
  { href: "/vacancies", label: "Vacancies" },
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
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-foreground/10 bg-card/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 sm:gap-8 min-w-0">
            <Link to="/assessments" className="shrink-0">
              <span className="font-display text-base sm:text-lg font-semibold tracking-tight text-foreground">
                Rakamin
              </span>
              <span className="hidden sm:inline font-display text-base sm:text-lg font-semibold tracking-tight text-primary">
                {" "}AI Interview
              </span>
            </Link>
            <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-none -mx-1 px-1">
              {navItems.map(({ href, label }) => {
                const active = location.pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    to={href}
                    className={cn(
                      "whitespace-nowrap px-2.5 sm:px-3 py-1.5 text-sm transition-colors border-b-2 -mb-px",
                      active
                        ? "border-primary text-foreground font-medium"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {tenant.name && (
              <span className="hidden sm:inline text-xs text-muted-foreground tracking-wide">
                {tenant.name}
              </span>
            )}
            <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3" onClick={handleLogout}>
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
