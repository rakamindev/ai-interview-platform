
import { useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import {
  LayoutDashboard,
  ClipboardList,
  BriefcaseBusiness,
  LogOut,
  Menu,
  X,
  Sparkles,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Code2,
  Settings,
  Users,
} from "lucide-react";

import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DateTimeDisplay from "./DateTimeDisplay";

const navigation = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    description: "Recruitment overview",
  },
  {
    href: "/assessments",
    label: "Assessments",
    icon: ClipboardList,
    description: "Manage assessments",
  },
  {
    href: "/vacancies",
    label: "Vacancies",
    icon: BriefcaseBusiness,
    description: "Manage vacancies",
  },
  {
    href: "/candidates",
    label: "Candidates",
    icon: Users,
    description: "Across all assessments",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Manage settings",
  }
];

const pageTitles: Record<string, string> = {
  dashboard: "Overview",
  assessments: "Assessments",
  vacancies: "Vacancies",
  candidates: "Candidates",
  settings: "Settings",
};

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const currentSection =
    location.pathname.split("/")[1] || "dashboard";

  const pageTitle =
    pageTitles[currentSection] || "Workspace";

  const isActive = (href: string) =>
    location.pathname === href ||
    location.pathname.startsWith(`${href}/`);

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F6F9FA]">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white transition-all duration-300",
          collapsed ? "lg:w-[84px]" : "lg:w-[260px]",
          mobileOpen
            ? "w-[260px] translate-x-0"
            : "w-[260px] -translate-x-full lg:translate-x-0"
        )}
      >
        <div
          className={cn(
            "flex h-[76px] items-center border-b border-slate-100 px-5",
            collapsed ? "lg:justify-center lg:px-3" : "justify-between"
          )}
        >
          <Link
            to="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="flex min-w-0 items-center gap-3"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-md shadow-primary/20">
              <Code2 className="h-5 w-5" />
            </span>

            <div className={cn(collapsed && "lg:hidden")}>
              <p className="text-[15px] font-extrabold tracking-tight text-slate-900">
                Rakamin AI
              </p>
              <p className="text-[10px] font-semibold tracking-[0.16em] text-primary">
                INTERVIEW
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-6">
          <p
            className={cn(
              "mb-3 px-3 text-[10px] font-bold tracking-[0.17em] text-slate-400",
              collapsed && "lg:text-center"
            )}
          >
            {collapsed ? (
              <span className="hidden lg:inline">MENU</span>
            ) : (
              "WORKSPACE"
            )}
            {collapsed && (
              <span className="lg:hidden">WORKSPACE</span>
            )}
          </p>

          <nav className="space-y-1.5" aria-label="Main navigation">
            {navigation.map(({ href, label, icon: Icon }) => (
              <NavLink
                key={href}
                to={href}
                title={collapsed ? label : undefined}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                  collapsed && "lg:justify-center lg:px-2",
                  isActive(href)
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon className="h-[19px] w-[19px] shrink-0" />

                <span className={cn(collapsed && "lg:hidden")}>
                  {label}
                </span>

                {isActive(href) && !collapsed && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="border-t border-slate-100 p-3">
          {tenant.name && (
            <div
              className={cn(
                "mb-3 rounded-xl border border-slate-100 bg-slate-50 p-3",
                collapsed && "lg:hidden"
              )}
            >
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Current workspace
              </p>

              <p className="truncate text-sm font-semibold text-slate-700">
                {tenant.name}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600",
              collapsed && "lg:justify-center lg:px-2"
            )}
          >
            <LogOut className="h-[19px] w-[19px] shrink-0" />
            <span className={cn(collapsed && "lg:hidden")}>
              Logout
            </span>
          </button>
        </div>
      </aside>

      <div
        className={cn(
          "min-h-screen transition-[margin] duration-300",
          collapsed ? "lg:ml-[84px]" : "lg:ml-[260px]"
        )}
      >
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur-md sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="hidden rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:flex"
              aria-label={
                collapsed ? "Expand sidebar" : "Collapse sidebar"
              }
            >
              {collapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </button>

            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden text-slate-400 sm:inline">
                Workspace
              </span>

              <ChevronRight className="hidden h-4 w-4 text-slate-300 sm:inline" />

              <span className="truncate font-semibold text-slate-800">
                {pageTitle}
              </span>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-4">
            <DateTimeDisplay />

            <div className="hidden h-6 w-px bg-slate-200 md:block" />

            <span
              className="max-w-[180px] truncate text-sm font-medium text-slate-700 lg:max-w-[260px]"
              title={localStorage.getItem("auth_email") ?? ""}
            >
              {localStorage.getItem("auth_email") ?? "User"}
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}