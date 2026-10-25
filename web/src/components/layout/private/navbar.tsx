import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom, clearTenant, defaultTenant } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { queryClient } from "@/lib/queryClient";
import {
  Sparkles,
  ClipboardList,
  Briefcase,
  Building2,
  Menu,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import PrivateNavMenu from "./menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const NAV_ITEMS = [
  {
    name: "Assessments",
    href: "/assessments",
    icon: ClipboardList,
  },
  {
    name: "Vacancies",
    href: "/vacancies",
    icon: Briefcase,
  },
];

export default function PrivateNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const tenant = useAtomValue(tenantAtom);
  const setTenant = useSetAtom(tenantAtom);
  const setAuth = useSetAtom(authAtom);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    clearToken();
    clearTenant();
    queryClient.clear();
    setAuth({ token: null });
    setTenant(defaultTenant);
    setMobileOpen(false);
    toast.success("Logged out successfully");
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/60 bg-background/95 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Desktop Nav Pills (Ottodot pattern) */}
        <div className="flex items-center gap-6">
          <Link
            to="/assessments"
            className="flex items-center gap-2.5 select-none transition-opacity hover:opacity-90"
          >
            <div className="flex h-8 w-8 min-w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-foreground leading-tight">
                Rakamin
              </span>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                AI Interview
              </span>
            </div>
          </Link>

          {/* Desktop/Tablet Navigation Pills */}
          <nav aria-label="Main" className="hidden sm:flex items-center gap-1.5">
            {NAV_ITEMS.map((item) => {
              const active =
                location.pathname === item.href ||
                (item.href !== "/assessments" &&
                  location.pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Button
                  key={item.href}
                  asChild
                  size="pill"
                  variant={active ? "default" : "ghost"}
                  className={cn(
                    "transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  )}
                >
                  <Link
                    to={item.href}
                    aria-current={active ? "page" : undefined}
                    className="flex items-center"
                  >
                    <Icon className="h-3.5 w-3.5 mr-1.5" />
                    {item.name}
                  </Link>
                </Button>
              );
            })}
          </nav>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Tenant Badge (Hidden on mobile for compact layout) */}
          {tenant.name && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 border border-border/50 text-xs text-muted-foreground font-medium">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span>{tenant.name}</span>
            </div>
          )}

          {/* Theme Switcher */}
          <ThemeToggle />

          {/* User Profile Menu */}
          <PrivateNavMenu />

          {/* Mobile Drawer Hamburger Trigger (Hidden on sm+) */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Open navigation menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 flex flex-col justify-between">
              <div>
                {/* Mobile Drawer Header */}
                <SheetHeader className="border-b border-border/40 p-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 min-w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col text-left">
                      <SheetTitle className="text-sm font-bold tracking-tight text-foreground leading-tight">
                        Rakamin
                      </SheetTitle>
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        AI Interview Platform
                      </span>
                    </div>
                  </div>
                </SheetHeader>

                {/* Mobile Navigation Links */}
                <div className="p-3 space-y-1">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Menu
                  </div>
                  {NAV_ITEMS.map((item) => {
                    const active =
                      location.pathname === item.href ||
                      (item.href !== "/assessments" &&
                        location.pathname.startsWith(item.href));
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </div>
                        <ChevronRight className={cn("h-4 w-4 opacity-60", active && "opacity-90")} />
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Drawer Footer */}
              <div className="border-t border-border/40 p-4 space-y-3 bg-card/30">
                {tenant.name && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    <span>Tenant: {tenant.name}</span>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 gap-2"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Logout</span>
                </Button>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>v2.0 Platform</span>
                  <span className="text-emerald-500 font-medium">Ready</span>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
