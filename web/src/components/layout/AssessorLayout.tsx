import { useEffect, useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  ClipboardList,
  Briefcase,
  UserPlus,
  LogOut,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
  { href: "/admin-invitations", label: "Admin Invitations", icon: UserPlus },
];

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auto-close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header */}
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Brand + desktop inline nav */}
          <div className="flex items-center gap-6 min-w-0">
            <Link to="/assessments" className="flex items-center gap-2 min-w-0">
              <LayoutDashboard className="h-5 w-5 text-primary shrink-0" />
              <span className="font-semibold text-sm truncate">Rakamin AI Interview</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                    location.pathname.startsWith(href)
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right side: tenant + logout (desktop), hamburger (mobile) */}
          <div className="flex items-center gap-3">
            {tenant.name && (
              <span className="hidden md:inline text-xs text-muted-foreground border rounded-full px-2.5 py-0.5">
                Tenant: {tenant.name}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="hidden md:inline-flex"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Logout
            </Button>

            {/* Mobile hamburger → drawer */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open navigation menu"
                  className="md:hidden inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 max-w-[80%] p-0">
                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                <div className="flex h-14 items-center border-b px-4">
                  <span className="flex items-center gap-2 min-w-0">
                    <LayoutDashboard className="h-5 w-5 text-primary shrink-0" />
                    <span className="font-semibold text-sm truncate">Rakamin AI Interview</span>
                  </span>
                </div>
                <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                  {navItems.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      to={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                        location.pathname.startsWith(href)
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </Link>
                  ))}
                </nav>
                <div className="border-t p-3 space-y-2">
                  {tenant.name && (
                    <span className="text-xs text-muted-foreground border rounded-full px-2.5 py-0.5 w-fit">
                      Tenant: {tenant.name}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4 mr-1.5" />
                    Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
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
