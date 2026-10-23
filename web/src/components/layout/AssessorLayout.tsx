import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { RakaminLogo } from "@/components/ui/RakaminLogo";
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
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
      {/* Top Standard SaaS Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/90 backdrop-blur-md shadow-sm transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left: Brand Monogram & Standard Nav Links */}
          <div className="flex items-center gap-8">
            <Link to="/assessments" className="transition-opacity hover:opacity-90 flex-shrink-0">
              <RakaminLogo size="md" subtitle="Talent Intelligence" />
            </Link>

            <nav className="hidden md:flex items-center gap-1.5">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = location.pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    to={href}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150",
                      isActive
                        ? "bg-primary/10 text-primary font-bold shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Tenant Pill, Theme Toggle & Logout Button */}
          <div className="flex items-center gap-3">
            {tenant.name && (
              <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-border/80 bg-muted/40 text-xs font-medium text-foreground shadow-sm">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span className="truncate max-w-[150px] font-semibold">{tenant.name}</span>
              </div>
            )}

            <div className="hidden sm:block h-5 w-[1px] bg-border/80 mx-0.5" />

            <ThemeToggle variant="button" />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-9 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} Rakamin Talent Intelligence Platform. Monozukuri Engineering.</span>
          <span className="text-[11px] opacity-75">Compliant with UU PDP No. 27/2022</span>
        </div>
      </footer>
    </div>
  );
}
