
import { useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ClipboardList,
  Briefcase,
  LogOut,
  Menu,
  X,
  Building2,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    setMobileMenuOpen(false);
    navigate("/login");
  };

  const isActive = (href: string) =>
    href === "/assessments"
      ? location.pathname.startsWith("/assessments")
      : location.pathname.startsWith(href);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const renderSidebar = (collapsed = false) => (
    <div className="flex h-full flex-col overflow-x-hidden bg-white">
      <Link
        to="/assessments"
        onClick={closeMobileMenu}
        title={collapsed ? "Rakamin — AI Interview Platform" : undefined}
        className={cn(
          "flex h-[76px] shrink-0 items-center border-b border-slate-100",
          collapsed ? "justify-center px-2" : "gap-3 px-5",
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#01959f] text-white shadow-sm shadow-teal-900/15">
          <LayoutDashboard className="h-5 w-5" />
        </div>

        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-slate-900">
              Rakamin
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              AI Interview Platform
            </p>
          </div>
        )}
      </Link>

      <div className={cn("pt-7", collapsed ? "px-2" : "px-4")}>
        {!collapsed && (
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Workspace
          </p>
        )}

        <nav aria-label="Main navigation" className="space-y-1.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);

            return (
              <Link
                key={href}
                to={href}
                onClick={closeMobileMenu}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : undefined}
                className={cn(
                  "group flex min-h-11 items-center rounded-xl text-sm font-medium transition-colors duration-150",
                  collapsed ? "justify-center px-2" : "gap-3 px-3.5",
                  active
                    ? "bg-teal-50 text-[#017f87]"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    active
                      ? "text-[#01959f]"
                      : "text-slate-400 group-hover:text-slate-600",
                  )}
                />

                {!collapsed && (
                  <>
                    <span className="flex-1">{label}</span>
                    {active && (
                      <ChevronRight className="h-4 w-4 text-[#01959f]" />
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div
        className={cn(
          "mt-auto border-t border-slate-100",
          collapsed ? "p-2" : "p-4",
        )}
      >
        {collapsed ? (
          <div
            title={`Current workspace: ${tenant.name || "Workspace"}`}
            className="mb-3 flex justify-center rounded-xl bg-slate-50 p-3"
          >
            <Building2 className="h-5 w-5 text-slate-500" />
          </div>
        ) : (
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Current workspace
              </p>
              <p className="mt-1 truncate text-xs font-semibold text-slate-700">
                {tenant.name || "Workspace"}
              </p>
            </div>
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          onClick={handleLogout}
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600",
            collapsed
              ? "w-full justify-center px-2"
              : "w-full justify-start gap-3 px-3.5",
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && "Sign out"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f6f8fa] text-slate-900">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200/80 transition-[width] duration-200 lg:block",
          sidebarCollapsed ? "w-[76px]" : "w-[260px]",
        )}
      >
        {renderSidebar(sidebarCollapsed)}
      </aside>

      {/* Main content follows sidebar width */}
      <div
        className={cn(
          "min-h-screen transition-[padding] duration-200",
          sidebarCollapsed ? "lg:pl-[76px]" : "lg:pl-[260px]",
        )}
      >
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            {/* Mobile toggle */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={
                mobileMenuOpen ? "Close navigation" : "Open navigation"
              }
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="shrink-0 lg:hidden"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>

            {/* Desktop toggle */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={
                sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
              aria-expanded={!sidebarCollapsed}
              onClick={() =>
                setSidebarCollapsed((collapsed) => !collapsed)
              }
              className="hidden shrink-0 lg:inline-flex"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </Button>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">
                {navItems.find(({ href }) => isActive(href))?.label ||
                  "Workspace"}
              </p>
              <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">
                AI-powered candidate assessment
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {tenant.name && (
              <div className="hidden max-w-[220px] items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 sm:flex">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <span className="truncate text-xs font-medium text-slate-600">
                  {tenant.name}
                </span>
              </div>
            )}

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-[#017f87]">
              R
            </div>
          </div>
        </header>

        {/* Mobile backdrop */}
        {mobileMenuOpen && (
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
            onClick={closeMobileMenu}
          />
        )}

        {/* Mobile sidebar */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-[280px] border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 lg:hidden",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          )}
          aria-hidden={!mobileMenuOpen}
        >
          {renderSidebar(false)}
        </div>

        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-9 lg:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
