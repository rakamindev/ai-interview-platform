import { useState, useRef, useEffect } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ClipboardList,
  Briefcase,
  Layers,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
  { href: "/skills", label: "Skills", icon: Layers },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AssessorLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const auth = useAtomValue(authAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null, user: null });
    navigate("/login");
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [menuOpen]);

  const user = auth.user;
  const userDisplayName = user?.email ? user.email.split("@")[0] : "Admin";
  const userRole = user?.role || "admin";
  const userInitials = userDisplayName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex bg-background">
      <aside
        data-testid="sidebar"
        className={cn(
          "bg-white border-r flex flex-col justify-between shrink-0 transition-all duration-200 sticky top-0 h-screen z-30",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex flex-col">
          <div className="h-14 border-b flex items-center justify-between px-3 relative">
            {!collapsed ? (
              <>
                <Link to="/assessments" className="flex items-center gap-2 overflow-hidden px-1">
                  <LayoutDashboard className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-semibold text-sm truncate">Rakamin AI</span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  data-testid="sidebar-toggle"
                  aria-label="Toggle sidebar"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setCollapsed(true)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Link to="/assessments" className="mx-auto flex items-center justify-center">
                  <LayoutDashboard className="h-5 w-5 text-primary" />
                </Link>
                <Button
                  variant="outline"
                  size="icon"
                  data-testid="sidebar-toggle"
                  aria-label="Toggle sidebar"
                  className="absolute -right-3 top-1/2 -translate-y-1/2 z-40 h-6 w-6 rounded-full border bg-white shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent p-0"
                  onClick={() => setCollapsed(false)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>

          <nav className="p-2 space-y-1" aria-label="Main Navigation">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = location.pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  to={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    collapsed && "justify-center px-0"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile Footer Section */}
        <div className="border-t p-2 relative" ref={menuRef}>
          {!collapsed ? (
            <button
              type="button"
              data-testid="user-profile-trigger"
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/60 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                  {userInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate text-foreground leading-tight">
                    {user?.email || "admin@example.com"}
                  </div>
                  <div className="text-[11px] text-muted-foreground capitalize leading-tight">
                    {userRole}
                  </div>
                </div>
              </div>
              <MoreVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ) : (
            <button
              type="button"
              data-testid="user-profile-trigger"
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center mx-auto border border-primary/20 hover:ring-2 hover:ring-primary/20 transition-all"
              title={`${user?.email || "admin@example.com"} (${userRole})`}
            >
              {userInitials}
            </button>
          )}

          {/* Popup Menu: Only two options (Profile or Log out) */}
          {menuOpen && (
            <div
              className={cn(
                "absolute bg-white border rounded-lg shadow-lg p-1 space-y-0.5 z-50 animate-in fade-in zoom-in-95",
                collapsed
                  ? "bottom-2 left-full ml-2 w-48"
                  : "bottom-full left-2 right-2 mb-2"
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/profile");
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md hover:bg-muted text-foreground transition-colors text-left"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Profile</span>
              </button>
              <button
                type="button"
                data-testid="logout-button"
                onClick={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md hover:bg-destructive/10 text-destructive transition-colors text-left"
              >
                <LogOut className="h-4 w-4" />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <div className="max-w-7xl mx-auto w-full px-6 py-6 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
