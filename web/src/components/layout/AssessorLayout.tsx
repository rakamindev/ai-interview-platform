import { useState } from "react";
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

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header */}
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          
          {/* Logo / Brand */}
          <Link to="/assessments" className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Rakamin AI Interview</span>
          </Link>

          {/* Desktop Navigation (Hidden on mobile) */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                to={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
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

          {/* Desktop Right Actions (Tenant & Logout) */}
          <div className="hidden md:flex items-center gap-3">
            {tenant.name && (
              <span className="text-xs text-muted-foreground border rounded-full px-2.5 py-0.5">
                Tenant: {tenant.name}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1.5" />
              Logout
            </Button>
          </div>

          {/* Mobile Hamburger Trigger (Visible only on mobile) */}
          <div className="flex md:hidden items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>

            {/* Backdrop / Overlay Gelap di Belakang */}
            {mobileMenuOpen && (
              <div 
                className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-300"
                onClick={() => setMobileMenuOpen(false)}
              />
            )}

            {/* Custom Sliding Drawer dari Kanan (Tanpa efek Zoom/Dialog) */}
            <div className={cn(
              "fixed right-0 top-0 bottom-0 z-50 h-full w-[280px] sm:w-[320px] bg-white p-6 shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-in-out",
              mobileMenuOpen ? "translate-x-0" : "translate-x-full"
            )}>
              <div>
                {/* Header Drawer & Tombol Close */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5 text-primary" />
                    <span className="text-lg font-bold">Menu</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-4 -mt-4">Navigasi aplikasi</p>

                {/* Mobile Nav Links */}
                <div className="flex flex-col space-y-2">
                  {navItems.map(({ href, label, icon: Icon }) => {
                    const isActive = location.pathname.startsWith(href);
                    return (
                      <Link
                        key={href}
                        to={href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Bottom Info & Logout */}
              <div className="pt-4 border-t space-y-4">
                {tenant.name && (
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-md text-center">
                    Tenant: <span className="font-medium text-foreground">{tenant.name}</span>
                  </div>
                )}
                <Button 
                  variant="destructive" 
                  className="w-full justify-center" 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>

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