import { useState, useEffect } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useUser } from "@/hooks/useUser";
import { useSetAtom } from "jotai";
import { authAtom, clearToken } from "@/stores/authAtom";
import { userAtom } from "@/stores/userAtom";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Briefcase,
  Settings,
  LogOut,
  Sparkles,
  Shield,
  Eye,
  UserCheck,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SidebarLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useSetAtom(authAtom);
  const setUser = useSetAtom(userAtom);
  const { user, organization, role, isAdmin, isHiringManager } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    setUser({ user: null, organization: null, loaded: false });
    navigate("/login");
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { href: "/candidates", label: "Candidates", icon: Users, show: true },
    { href: "/assessments", label: "Assessments", icon: ClipboardList, show: !isHiringManager },
    { href: "/vacancies", label: "Vacancies", icon: Briefcase, show: true },
    { href: "/settings", label: "Settings", icon: Settings, show: isAdmin },
  ].filter((item) => item.show);

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <Link
          to="/dashboard"
          onClick={() => isMobile && setMobileOpen(false)}
          className="flex items-center gap-2.5"
        >
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <span className="font-bold text-sm tracking-tight text-foreground block">
              Rakamin AI
            </span>
            <span className="text-[10px] text-muted-foreground block truncate max-w-[120px]">
              {organization?.name || "AI Interview"}
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileOpen(false)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground ml-1"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Role Badge */}
      <div className="px-4 py-2.5 bg-muted/30 border-b flex items-center gap-2">
        {isAdmin ? (
          <Shield className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        ) : isHiringManager ? (
          <Eye className="h-3.5 w-3.5 text-teal-500 shrink-0" />
        ) : (
          <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
        )}
        <span className="text-xs font-semibold capitalize text-foreground">
          {role.replace("_", " ")}
        </span>
        {isHiringManager && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 font-medium ml-auto">
            Read-only
          </span>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? location.pathname === "/" || location.pathname === "/dashboard"
              : location.pathname.startsWith(href);

          return (
            <Link
              key={href}
              to={href}
              onClick={() => isMobile && setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-primary-foreground" : "text-muted-foreground"
                )}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="p-3 border-t bg-card mt-auto space-y-2">
        <div className="flex items-center justify-between px-2 py-1">
          <div className="min-w-0 pr-2">
            <p className="text-xs font-semibold text-foreground truncate">
              {user?.email || "User"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {organization?.scheme || "Portal"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background text-foreground">
      {/* Mobile Topbar (< lg) */}
      <header className="lg:hidden sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileOpen(true)}
            className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-sm tracking-tight text-foreground">
              Rakamin AI
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-foreground truncate max-w-[140px]">
              {user?.email}
            </p>
            <p className="text-[10px] text-muted-foreground capitalize">
              {role.replace("_", " ")}
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile Drawer Backdrop & Sidebar (< lg) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-out Sidebar Drawer */}
          <div className="relative w-72 max-w-[80vw] bg-card h-full flex flex-col border-r shadow-2xl z-10 animate-in slide-in-from-left duration-250">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}

      {/* Desktop Sticky Sidebar (>= lg) */}
      <aside className="hidden lg:flex w-64 border-r bg-card flex-col shrink-0 sticky top-0 h-screen z-30 select-none">
        {renderSidebarContent(false)}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-6 lg:p-8 space-y-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
