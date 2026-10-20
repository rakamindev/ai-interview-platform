import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Check,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

  const activeItem = navItems.find((item) => location.pathname.startsWith(item.href));
  const tenantInitial = (tenant.name ?? "R").slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/assessments" className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <LayoutDashboard className="h-5 w-5" />
            </span>
            <span className="truncate text-sm font-semibold tracking-tight sm:text-base">
              <span className="sm:hidden">Rakamin AI</span>
              <span className="hidden sm:inline">Rakamin AI Interview</span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = location.pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  to={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm transition-colors",
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex min-w-0 items-center gap-2">
            {tenant.name && (
              <span
                title={`Tenant: ${tenant.name}`}
                className="hidden max-w-[22rem] shrink-0 whitespace-nowrap rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground md:inline-flex"
              >
                Tenant: {tenant.name}
              </span>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden h-10 w-10 rounded-full bg-secondary/35 text-secondary-foreground hover:bg-secondary/50 sm:inline-flex"
                  aria-label="Open account menu"
                >
                  <span className="text-sm font-semibold">{tenantInitial}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="space-y-1">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Workspace</span>
                  <span className="block whitespace-normal leading-relaxed">{tenant.name ?? "Workspace"}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="sm:hidden" aria-label="Open navigation menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary/35 text-xs font-semibold text-secondary-foreground">
                    {tenantInitial}
                  </span>
                  <span className="min-w-0 whitespace-normal">{tenant.name ?? "Workspace"}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {navItems.map(({ href, label, icon: Icon }) => (
                  <DropdownMenuItem key={href} onSelect={() => navigate(href)}>
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
                    {activeItem?.href === href && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
