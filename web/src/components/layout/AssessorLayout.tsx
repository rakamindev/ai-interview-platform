import { useState } from "react";
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
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
  className,
}: {
  href: string;
  label: string;
  icon: typeof ClipboardList;
  active: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <Link
      to={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2",
        active
          ? "bg-primary-muted text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    navigate("/login");
  };

  const isActive = (href: string) => location.pathname.startsWith(href);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <header className="border-b border-border bg-white sticky top-0 z-40 shadow-sm shadow-black/[0.02]">
        <div className="max-w-[1560px] mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-8 min-w-0">
            <Link
              to="/assessments"
              className="flex items-center gap-2 shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2"
            >
              <LayoutDashboard className="h-5 w-5 text-primary" aria-hidden />
              <span className="font-semibold text-sm text-foreground truncate">
                Rakamin AI Interview
              </span>
            </Link>

            <nav
              className="hidden md:flex items-center gap-1"
              aria-label="Main navigation"
            >
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  active={isActive(item.href)}
                />
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {tenant.name && (
              <span
                className="hidden sm:inline-flex text-xs text-muted-foreground border border-border rounded-full px-2.5 py-1 bg-white max-w-[140px] md:max-w-none truncate"
                title={`Tenant: ${tenant.name}`}
              >
                Tenant: {tenant.name}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              aria-label="Logout"
              className="h-10 px-2 sm:px-3 focus-visible:ring-2 focus-visible:ring-primary/25"
            >
              <LogOut className="h-4 w-4 sm:mr-1.5" aria-hidden />
              <span className="hidden sm:inline">Logout</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-11 w-11 focus-visible:ring-2 focus-visible:ring-primary/25"
              onClick={() => setMobileOpen((o) => !o)}
              aria-expanded={mobileOpen}
              aria-controls="assessor-mobile-nav"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div
            id="assessor-mobile-nav"
            className="md:hidden border-t border-border bg-white px-4 py-3 space-y-1"
          >
            {tenant.name && (
              <p className="sm:hidden text-xs text-muted-foreground border border-border rounded-full px-2.5 py-1 mb-2 inline-block">
                Tenant: {tenant.name}
              </p>
            )}
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                active={isActive(item.href)}
                onNavigate={() => setMobileOpen(false)}
                className="w-full min-h-[44px]"
              />
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 max-w-[1560px] mx-auto w-full px-4 sm:px-6 py-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
