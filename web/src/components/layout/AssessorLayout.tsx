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
    <div className="min-h-screen flex flex-col bg-[hsl(184_20%_98%)]">
      <header className="border-b border-border/80 bg-white/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <Link to="/assessments" className="items-center gap-2 shrink-0 hidden sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <LayoutDashboard className="h-4 w-4 text-primary" />
              </span>
              <span className="font-semibold text-sm hidden xs:inline sm:inline truncate max-w-[9rem] sm:max-w-none">
                Rakamin AI Interview
              </span>
            </Link>
            <nav className="flex items-center gap-0.5 sm:gap-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = location.pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    to={href}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-sm transition-colors",
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {tenant.name && (
              <span className="hidden md:inline-flex text-xs text-muted-foreground border rounded-full px-2.5 py-0.5 max-w-[10rem] truncate">
                {tenant.name}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="px-2 sm:px-3">
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
