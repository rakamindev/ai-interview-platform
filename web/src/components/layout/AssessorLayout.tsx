import { useEffect, useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ClipboardList, Briefcase, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
];

function SidebarContent({ tenantName, onLogout, onNavigate }: { tenantName?: string | null; onLogout: () => void; onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <div className="flex h-full flex-col">
      <Link to="/assessments" className="flex items-center gap-2 px-4 h-14 border-b shrink-0" onClick={onNavigate}>
        <LayoutDashboard className="h-5 w-5 text-primary shrink-0" />
        <span className="font-semibold text-sm truncate">Rakamin AI Interview</span>
      </Link>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            to={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
              location.pathname.startsWith(href)
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t p-3 space-y-2 shrink-0">
        {tenantName && (
          <div className="text-xs text-muted-foreground border rounded-full px-2.5 py-0.5 w-fit max-w-full truncate">
            Tenant: {tenantName}
          </div>
        )}
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={onLogout}>
          <LogOut className="h-4 w-4 mr-1.5" />
          Logout
        </Button>
      </div>
    </div>
  );
}

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 md:left-0 border-r bg-white">
        <SidebarContent tenantName={tenant.name} onLogout={handleLogout} />
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden border-b bg-white sticky top-0 z-40 flex items-center justify-between px-3 h-14">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/assessments" className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Rakamin AI Interview</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
          aria-label="Logout"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-foreground z-10"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent tenantName={tenant.name} onLogout={handleLogout} onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      {/* Page content */}
      <main className="flex-1 md:pl-60 w-full min-w-0">
        <div className="max-w-4xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
