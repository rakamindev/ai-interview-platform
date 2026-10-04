import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { ClipboardList, Briefcase, LogOut } from "lucide-react";
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
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-8 overflow-hidden">
            <Link to="/assessments" className="flex items-center gap-2.5 shrink-0">
              <img
                src="/rakamin-logo.png"
                alt="Rakamin"
                className="h-6 w-auto object-contain"
              />
              <span className="hidden sm:inline-block text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                AI Interview
              </span>
            </Link>
            <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  title={label}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap",
                    location.pathname.startsWith(href)
                      ? "text-primary font-semibold bg-primary/5"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
            {tenant.name && (
              <span className="hidden md:inline-block text-xs text-muted-foreground border rounded-full px-2.5 py-0.5 whitespace-nowrap">
                Tenant: {tenant.name}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="px-2 sm:px-3" title="Logout">
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Logout</span>
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
