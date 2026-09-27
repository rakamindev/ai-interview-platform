import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken, isSuperAdmin } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { ClipboardList, Briefcase, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

import rakaminLogo from "@/assets/rakamin-logo-transparent.png";

const baseNavItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
];

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const auth = useAtomValue(authAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();

  const isSuper = isSuperAdmin(auth.token);
  const navItems = [
    ...baseNavItems,
    ...(isSuper ? [{ href: "/admin/users", label: "Admin", icon: ShieldCheck }] : []),
  ];

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header */}
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-6 min-w-0">
            <Link to="/assessments" className="flex items-center gap-2 shrink-0 group">
              <img src={rakaminLogo} alt="Rakamin" className="h-6 sm:h-7 w-auto object-contain" />
              <span className="hidden sm:inline-block h-4 w-px bg-border" aria-hidden="true" />
              <span className="hidden sm:inline-block font-medium text-xs sm:text-sm text-muted-foreground whitespace-nowrap group-hover:text-foreground transition-colors">
                AI Interview
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  title={label}
                  aria-label={label}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-sm transition-colors",
                    location.pathname.startsWith(href)
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden md:inline">{label}</span>
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {isSuper ? (
              <span
                className="hidden sm:inline-block text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2.5 py-0.5"
                title="Super Admin (All Tenants)"
              >
                Super Admin (All Tenants)
              </span>
            ) : tenant.name ? (
              <span
                className="hidden sm:inline-block text-xs text-muted-foreground border rounded-full px-2.5 py-0.5 truncate max-w-[140px]"
                title={`Tenant: ${tenant.name}`}
              >
                Tenant: {tenant.name}
              </span>
            ) : null}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="px-2.5 sm:px-3" title="Logout">
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
