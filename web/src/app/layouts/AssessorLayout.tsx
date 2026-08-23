import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/shared/stores/tenantAtom";
import { authAtom, clearToken } from "@/features/auth/stores/authAtom";
import AccountMenu from "@/app/layouts/components/AccountMenu";
import { LayoutDashboard, ClipboardList, Briefcase, Menu } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useLocation } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

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
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between md:grid md:grid-cols-3">
          {/* Left: brand */}
          <Link to="/assessments" className="flex items-center gap-2 justify-self-start shrink-0">
            <LayoutDashboard className="h-5 w-5 text-primary shrink-0" />
            <span className="font-display text-sm font-semibold hidden sm:inline">
              Rakamin AI Interview
            </span>
          </Link>

          {/* Center: nav (desktop) */}
          <nav className="hidden md:flex items-center gap-1 justify-self-center">
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

          {/* Right: mobile nav + account */}
          <div className="flex items-center gap-2 md:gap-3 justify-self-end">
            {/* Mobile nav trigger */}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Open navigation menu"
                className={cn(
                  "md:hidden inline-flex items-center justify-center rounded-md p-2 text-muted-foreground",
                  "transition-colors hover:bg-muted hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                )}
              >
                <Menu className="h-5 w-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {navItems.map(({ href, label, icon: Icon }) => (
                  <DropdownMenuItem key={href} asChild>
                    <Link
                      to={href}
                      className={cn(
                        "flex items-center gap-2 cursor-pointer",
                        location.pathname.startsWith(href) && "text-primary font-medium"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <AccountMenu tenantName={tenant.name} onLogout={handleLogout} />
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
