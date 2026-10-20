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

  const renderNav = (className?: string) => (
    <nav className={cn("flex items-center gap-1", className)}>
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          to={href}
          className={cn(
            "flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
            location.pathname.startsWith(href)
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header */}
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-6 min-w-0">
            <Link to="/assessments" className="flex items-center gap-2 min-w-0">
              <LayoutDashboard className="h-5 w-5 shrink-0 text-primary" />
              <span className="font-semibold text-sm truncate">
                Rakamin AI Interview
              </span>
            </Link>
            {/* Desktop nav (inline) */}
            {renderNav("hidden md:flex")}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {tenant.name && (
              <span className="hidden sm:inline-block max-w-[10rem] lg:max-w-[16rem] truncate text-xs text-muted-foreground border rounded-full px-2.5 py-0.5">
                Tenant: {tenant.name}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Mobile nav (second row, scrolls if it overflows) */}
        <div className="md:hidden border-t">
          <div className="px-4 py-1.5 overflow-x-auto">{renderNav()}</div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}
