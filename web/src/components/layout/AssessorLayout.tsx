import { useState, useEffect } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  ClipboardList,
  Briefcase,
  LogOut,
  Menu,
  X,
  User,
  Building,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList, adminOnly: false },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase, adminOnly: true },
];

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const { user } = useAtomValue(authAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  // Auto-close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null, user: null });
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header */}
      <header className="border-b bg-white sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo & Desktop Nav */}
          <div className="flex items-center gap-6">
            <Link
              to="/assessments"
              className="flex items-center gap-2 font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <LayoutDashboard className="h-4 w-4" />
              </div>
              <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent font-bold">
                Rakamin AI Interview
              </span>
            </Link>

            {/* Desktop Nav Items */}
            <nav className="hidden md:flex items-center gap-1">
              {visibleNavItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
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
          </div>

          {/* Desktop Right User Controls with Avatar Dropdown */}
          <div className="hidden md:flex items-center gap-3">
            {tenant.name && (
              <span className="text-xs text-muted-foreground border bg-muted/30 rounded-full px-2.5 py-1 flex items-center gap-1.5 font-medium">
                <Building className="h-3 w-3 text-muted-foreground" />
                {tenant.name}
              </span>
            )}

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full border bg-white hover:bg-slate-50 transition-all outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-xs group"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center border border-primary/20 group-hover:scale-105 transition-transform">
                      {user.email.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
                      {user.email}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  className="w-56 p-1.5 shadow-lg rounded-xl border mt-1"
                >
                  <DropdownMenuLabel className="font-normal px-2.5 py-2">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold leading-none truncate max-w-[150px]">
                          {user.email}
                        </p>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-0.5">
                          <ShieldCheck className="h-2.5 w-2.5" />
                          {user.role}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator className="my-1" />

                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-xs py-2 px-2.5 rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10 flex items-center gap-2 font-medium"
                  >
                    <LogOut className="h-4 w-4 text-destructive" />
                    Logout Account
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Mobile Hamburger Toggle Button */}
          <div className="flex items-center gap-2 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white px-4 pt-3 pb-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
            {/* User Profile Card */}
            {user && (
              <div className="p-3 rounded-lg bg-muted/60 border space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground truncate max-w-[200px]">
                    {user.email}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {user.role}
                  </span>
                </div>
                {tenant.name && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Building className="h-3 w-3" />
                    <span>Tenant: {tenant.name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Navigation Links */}
            <div className="space-y-1">
              {visibleNavItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    location.pathname.startsWith(href)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {label}
                </Link>
              ))}
            </div>

            {/* Mobile Logout */}
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout Account
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
