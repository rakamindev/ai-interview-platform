import { useState, useEffect } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  LayoutDashboard,
  ClipboardList,
  Briefcase,
  Settings,
  LogOut,
  Menu,
  X,
  WifiOff,
  AlertTriangle,
  RotateCw,
  User,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/services/api";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Sidebar collapse state with localStorage persistence
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("rakamin_sidebar_collapsed") === "true";
  });

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("rakamin_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Connectivity states
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [apiError, setApiError] = useState(false);
  const [checkingApi, setCheckingApi] = useState(false);

  // Internet online/offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const checkApiHealth = async () => {
    setCheckingApi(true);
    try {
      await api.get("/assessments", { params: { per_page: 1 } });
      setApiError(false);
    } catch {
      setApiError(true);
    } finally {
      setCheckingApi(false);
    }
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    clearToken();
    setAuth({ token: null });
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-slate-50/60 font-sans text-slate-800 antialiased">
      {/* ── Left Sidebar (Desktop) ────────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-white border-r border-slate-200/80 sticky top-0 h-screen z-30 shadow-[1px_0_4px_rgba(0,0,0,0.02)] transition-[width] duration-300 ease-in-out overflow-hidden select-none",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Sidebar Header: Constant left-anchored layout (Point 51: Icon-only + typed 'Rakamin' on expand) */}
        <div className="h-16 flex items-center px-3 border-b border-slate-100 shrink-0 overflow-hidden">
          <div
            className="h-10 flex items-center cursor-pointer hover:opacity-90 transition-opacity shrink-0"
            onClick={toggleSidebar}
            title={isCollapsed ? "Click to expand sidebar" : "Rakamin AI Interview"}
          >
            {/* Always the same logo icon graphic */}
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <img
                src="/rakamin-icon.png"
                alt="Rakamin"
                className="h-7 w-7 object-contain"
              />
            </div>

            {/* When expanded, add the typed brand name 'Rakamin' with matching logo font */}
            <div
              className={cn(
                "flex flex-col justify-center transition-all duration-300 ease-in-out ml-2 overflow-hidden whitespace-nowrap",
                isCollapsed ? "max-w-0 opacity-0 pointer-events-none ml-0" : "max-w-[140px] opacity-100"
              )}
            >
              <span className="font-bold text-xl tracking-tight text-slate-900 font-sans leading-none">
                Rakamin
              </span>
              <span className="text-[10px] text-primary font-semibold tracking-wide uppercase mt-0.5 leading-none">
                AI Interview
              </span>
            </div>
          </div>

          {/* Toggle Button: Always inside the sidebar boundary */}
          <div
            className={cn(
              "ml-auto flex items-center shrink-0 transition-opacity duration-300",
              isCollapsed ? "opacity-0 pointer-events-none w-0" : "opacity-100 w-auto"
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
              onClick={toggleSidebar}
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Quick Expand Toggle Icon strictly INSIDE the sidebar when collapsed */}
        <div
          className={cn(
            "px-3 pt-2 pb-1 transition-all duration-300 ease-in-out overflow-hidden shrink-0",
            isCollapsed ? "max-h-12 opacity-100" : "max-h-0 opacity-0 pointer-events-none pt-0 pb-0"
          )}
        >
          <button
            type="button"
            onClick={toggleSidebar}
            title="Expand sidebar"
            className="w-10 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Items: Left-anchored icons with smooth label fade to prevent bouncy jumps */}
        <nav className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto overflow-x-hidden">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/dashboard"
                ? location.pathname === "/" || location.pathname === "/dashboard"
                : location.pathname.startsWith(href);

            return (
              <Link
                key={href}
                to={href}
                title={isCollapsed ? label : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors duration-200 group overflow-hidden h-10 px-0",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
                )}
              >
                {/* Fixed 40px icon box: completely stable at x=12px, zero movement during width change */}
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-600"
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "truncate whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ml-1",
                    isCollapsed ? "max-w-0 opacity-0 pointer-events-none" : "max-w-[150px] opacity-100"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Global Error State Alert Banners */}
        {(!isOnline || apiError) && (
          <div className="px-3 pb-3 space-y-2 shrink-0 overflow-hidden">
            {!isOnline && (
              <div
                className={cn(
                  "rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs transition-all",
                  isCollapsed ? "p-2 flex flex-col items-center" : "p-2.5 space-y-1.5"
                )}
                title="Failed to connect to Internet"
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <WifiOff className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                  {!isCollapsed && <span>Failed to connect to Internet</span>}
                </div>
                {!isCollapsed && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-6 text-[11px] border-rose-300 text-rose-800 hover:bg-rose-100"
                    onClick={() => setIsOnline(navigator.onLine)}
                  >
                    <RotateCw className="h-3 w-3 mr-1" /> Try again
                  </Button>
                )}
              </div>
            )}

            {apiError && isOnline && (
              <div
                className={cn(
                  "rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs transition-all",
                  isCollapsed ? "p-2 flex flex-col items-center" : "p-2.5 space-y-1.5"
                )}
                title="Failed to connect to API"
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  {!isCollapsed && <span>Failed to connect to API</span>}
                </div>
                {!isCollapsed && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={checkingApi}
                    className="w-full h-6 text-[11px] border-amber-300 text-amber-800 hover:bg-amber-100"
                    onClick={checkApiHealth}
                  >
                    <RotateCw className={cn("h-3 w-3 mr-1", checkingApi && "animate-spin")} />
                    {checkingApi ? "Checking..." : "Try again"}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Logout Button (Bottom of Sidebar) */}
        <div className="p-3 border-t border-slate-100 shrink-0 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            title={isCollapsed ? "Logout" : undefined}
            className="w-full flex items-center rounded-lg text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors group overflow-hidden h-10 px-0"
          >
            {/* Fixed 40px icon box matching navigation items */}
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <LogOut className="h-5 w-5 text-slate-400 group-hover:text-rose-500 transition-colors" />
            </div>
            <span
              className={cn(
                "whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ml-1",
                isCollapsed ? "max-w-0 opacity-0 pointer-events-none" : "max-w-[150px] opacity-100"
              )}
            >
              Logout
            </span>
          </button>
        </div>
      </aside>

      {/* ── Main Layout Wrapper ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200/80 sticky top-0 z-20 px-4 sm:px-6 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          {/* Mobile menu trigger */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden h-9 w-9 p-0 text-slate-600"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-100 border border-slate-200/80 rounded-md px-2.5 py-1">
                AI Interview Platform
              </span>
            </div>
          </div>

          {/* Right Header: Tenant Info & HR Admin Profile */}
          <div className="flex items-center gap-3 ml-auto">
            {tenant.name && (
              <span className="hidden sm:inline-flex items-center text-xs text-slate-500 bg-slate-100 border border-slate-200/80 rounded-full px-2.5 py-0.5 font-medium">
                Tenant: {tenant.name}
              </span>
            )}

            {/* HR Admin Profile Badge */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs">
                <User className="h-4 w-4" />
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 leading-tight">
                  HR Admin
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Assessor Portal
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 bg-white px-4 py-3 space-y-1 shadow-md">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                to={href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium",
                  location.pathname.startsWith(href)
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setShowLogoutModal(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        )}

        {/* Page Content Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
          <Outlet />
        </main>
      </div>

      {/* ── Logout Confirmation Modal ───────────────────────────────── */}
      <Dialog open={showLogoutModal} onOpenChange={setShowLogoutModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center sm:text-left text-lg font-semibold text-slate-900">
              Are you sure to logout?
            </DialogTitle>
            <DialogDescription className="text-center sm:text-left text-sm text-slate-500">
              You will be returned to the Rakamin assessor login screen. Any unsaved changes in current forms may be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowLogoutModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmLogout}
            >
              Yes, Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
