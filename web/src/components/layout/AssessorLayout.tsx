import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ClipboardList,
  Briefcase,
  LogOut,
  X,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import { useState } from "react";

const navItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
];

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();
  // Di dalam component
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    navigate("/login");
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-white border-b">
        <div className="w-full px-3 mx-auto max-w-7xl sm:px-4">
          {/* Main header */}
          <div className="flex items-center justify-between gap-3 min-h-14">
            {/* Logo */}
            <Link
              to="/assessments"
              className="flex items-center min-w-0 gap-2"
              onClick={() => setIsMenuOpen(false)}
            >
              <LayoutDashboard className="w-5 h-5 shrink-0 text-primary" />
              <span className="text-sm font-semibold truncate">
                Rakamin AI Interview
              </span>
            </Link>

            {/* Desktop navigation */}
            <nav className="items-center hidden gap-1 md:flex">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors",
                    location.pathname.startsWith(href)
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
            </nav>

            {/* Desktop tenant and logout */}
            <div className="items-center hidden gap-3 md:flex">
              {tenant?.name && (
                <span
                  title={tenant.name}
                  className="max-w-40 truncate rounded-full border px-2.5 py-1 text-xs text-muted-foreground lg:max-w-56"
                >
                  Tenant: {tenant.name}
                </span>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="shrink-0"
              >
                <LogOut className="mr-1.5 h-4 w-4" />
                Logout
              </Button>
            </div>

            {/* Mobile hamburger button */}
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-md h-9 w-9 shrink-0 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
              aria-label={isMenuOpen ? "Tutup menu" : "Buka menu"}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-navigation"
            >
              {isMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Mobile dropdown menu */}
          {isMenuOpen && (
            <div id="mobile-navigation" className="py-3 border-t md:hidden">
              <nav className="flex flex-col gap-1">
                {navItems.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    to={href}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                      location.pathname.startsWith(href)
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{label}</span>
                  </Link>
                ))}
              </nav>

              {/* Mobile tenant information */}
              {tenant?.name && (
                <div className="pt-3 mt-3 border-t">
                  <p className="px-3 py-2 text-xs truncate text-muted-foreground">
                    Tenant: {tenant.name}
                  </p>
                </div>
              )}

              {/* Mobile logout */}
              <div className="pt-3 mt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleLogout();
                  }}
                  className="justify-start w-full"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 w-full px-3 py-4 mx-auto max-w-7xl sm:px-4 sm:py-5 lg:px-6 lg:py-6">
        <Outlet />
      </main>
    </div>
  );
}
