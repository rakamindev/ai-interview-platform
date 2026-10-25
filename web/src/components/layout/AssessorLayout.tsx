import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Briefcase,
  ChevronDown,
  ClipboardList,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
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

  const handleNavigation = () => setMobileOpen(false);

  const navigation = (
    <nav aria-label="Primary navigation" className="space-y-1">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = isActivePath(location.pathname, href);
        return (
          <Link
            key={href}
            to={href}
            onClick={handleNavigation}
            className={cn(
              "group relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
              active
                ? "bg-primary/10 font-semibold text-primary"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
            )}
          >
            {active && <span className="absolute -left-4 h-7 w-1 rounded-r-full bg-primary" />}
            <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "text-slate-500 group-hover:text-slate-900")} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const account = tenant.name ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-11 gap-2 rounded-lg px-2 hover:bg-slate-50"
          aria-label={`Open ${tenant.name} account menu`}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {tenant.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden max-w-32 truncate text-sm font-medium text-slate-700 sm:block">{tenant.name}</span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-xs text-muted-foreground">Workspace</p>
          <p className="truncate text-sm font-medium">{tenant.name}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout" className="h-9 w-9 shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-950">
      <LogOut className="h-4 w-4" />
      <span className="sr-only">Logout</span>
    </Button>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-slate-950/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        aria-label="Workspace navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col border-r border-slate-200 bg-white transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-[82px] items-center border-b border-slate-200 px-4">
          <button
            type="button"
            aria-label="Go to assessments"
            onClick={() => {
              navigate("/assessments");
              handleNavigation();
            }}
            className="flex min-w-0 items-center gap-2.5 text-left"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">R</span>
            <span className="whitespace-nowrap text-[14px] font-bold tracking-tight text-slate-950">Rakamin AI Interview</span>
          </button>
          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 md:hidden" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-1 flex-col px-4 py-5">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Workspace</p>
          {navigation}
          <div className="mt-auto border-t border-slate-200 pt-5">
            <p className="px-3 text-xs text-slate-400">Assessment tools appear in context</p>
          </div>
        </div>
      </aside>

      <div className="min-h-screen md:-mt-[100vh] md:pl-[250px]">
        <header className="sticky top-0 z-30 flex h-[82px] items-center border-b border-slate-200 bg-white px-4 md:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="mr-3 h-11 w-11 md:hidden"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>
          <div className="hidden text-sm text-slate-500 md:block">Assessment workspace</div>
          <div className="ml-auto flex items-center gap-2">
            {account}
          </div>
        </header>
        <main className="min-h-[calc(100vh-5.125rem)] px-4 py-7 md:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
