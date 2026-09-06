import { useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  Briefcase,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  Building2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    href: "/assessments",
    label: "Assessments",
    icon: ClipboardList,
  },
  {
    href: "/vacancies",
    label: "Vacancies",
    icon: Briefcase,
  },
];

function getBreadcrumbs(pathname: string) {
  if (pathname.startsWith("/assessments")) {
    const crumbs = [{ label: "Assessments", href: "/assessments" }];
    if (pathname.includes("/new")) crumbs.push({ label: "New Assessment", href: "" });
    else if (pathname.includes("/invite")) crumbs.push({ label: "Invite Candidate", href: "" });
    else if (pathname.includes("/edit")) crumbs.push({ label: "Edit Assessment", href: "" });
    else if (pathname.includes("/monitor")) crumbs.push({ label: "Live Monitor", href: "" });
    else if (pathname.includes("/portfolio")) crumbs.push({ label: "Portfolio Results", href: "" });
    else if (pathname.includes("/transcript")) crumbs.push({ label: "Transcript", href: "" });
    else if (pathname.includes("/fitgap")) crumbs.push({ label: "Fit/Gap Analysis", href: "" });
    return crumbs;
  }
  if (pathname.startsWith("/vacancies")) {
    const crumbs = [{ label: "Vacancies", href: "/vacancies" }];
    if (pathname.includes("/new")) crumbs.push({ label: "New Vacancy", href: "" });
    else if (pathname.includes("/edit")) crumbs.push({ label: "Edit Vacancy", href: "" });
    return crumbs;
  }
  return [{ label: "Dashboard", href: "/assessments" }];
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

  const breadcrumbs = getBreadcrumbs(location.pathname);

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between bg-white select-none">
      {/* Top section: Logo & Workspace info */}
      <div className="space-y-4">
        {/* Brand header */}
        <div className="h-14 px-5 flex items-center justify-between border-b border-border/70">
          <Link
            to="/assessments"
            className="flex items-center gap-2.5 group transition-transform active:scale-[0.98]"
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm tracking-tight text-foreground">Rakamin</span>
                <span className="font-light text-sm text-primary">AI Interview</span>
              </div>
            </div>
          </Link>

          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground md:hidden"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <div className="px-3 space-y-1">
          <div className="px-2 py-1">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground/60 uppercase">
              Main Navigation
            </p>
          </div>
          <nav className="space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = location.pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  to={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group active:scale-[0.98]",
                    active
                      ? "text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-neutral-100/60"
                  )}
                >
                  {/* Micro-animation layout pill on active */}
                  {active && (
                    <motion.div
                      layoutId="sidebarActivePill"
                      className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/20 shadow-2xs"
                      transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    />
                  )}

                  <div className="relative z-10 flex items-center justify-center">
                    <Icon className={cn("h-4 w-4 shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  </div>

                  <div className="relative z-10 min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate">{label}</span>
                      {active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom section: Assessor account info & Logout */}
      <div className="p-3 border-t border-border/70 space-y-2">
        {/* User Card */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-50/70 border border-border/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-neutral-200 text-neutral-700 flex items-center justify-center font-medium text-xs">
              AS
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">Assessor Portal</p>
            </div>
          </div>
        </div>

        {/* Logout button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors h-9 rounded-xl active:scale-[0.98]"
        >
          <LogOut className="h-3.5 w-3.5 mr-2 shrink-0" />
          <span>Log out</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-neutral-50/40">
      {/* Desktop Sidebar (Fixed Left) */}
      <aside className="hidden md:flex w-64 shrink-0 h-screen sticky top-0 border-r border-border/80 flex-col z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Slide-out) */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-xs"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white z-50 md:hidden shadow-2xl"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Header Navbar */}
        <header className="h-14 border-b border-border/70 bg-white/85 backdrop-blur-md sticky top-0 z-20 px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(true)}
              className="p-1.5 rounded-lg border border-border/70 text-muted-foreground hover:text-foreground md:hidden active:scale-95 transition-transform"
              aria-label="Open sidebar menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <div key={idx} className="flex items-center gap-1.5 min-w-0">
                    {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
                    {crumb.href && !isLast ? (
                      <Link
                        to={crumb.href}
                        className="hover:text-foreground transition-colors font-medium truncate"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={cn("truncate", isLast ? "font-semibold text-foreground" : "font-medium")}>
                        {crumb.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Right Header Badges / Info */}
          <div className="flex items-center gap-2.5">
            {tenant.name && (
              <div className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border/70 bg-neutral-50 rounded-full px-2.5 py-1">
                <Building2 className="h-3 w-3 text-primary" />
                <span className="truncate max-w-[120px]">{tenant.name}</span>
              </div>
            )}
          </div>
        </header>

        {/* Page Content with Micro-entrance Animation */}
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}
