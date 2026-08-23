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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    navigate("/login");
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header */}
      <header className="border-b bg-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-1 -ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <Link to="/assessments" className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Rakamin AI Interview</span>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 ml-4">
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
          </div>
          
          <div className="flex items-center gap-3">
            {tenant.name && (
              <span className="hidden md:inline-flex text-xs text-muted-foreground border rounded-full px-2.5 py-0.5">
                Tenant: {tenant.name}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden sm:inline-flex">
              <LogOut className="h-4 w-4 mr-1.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Mobile Sidebar */}
      <div 
        className={cn(
          "fixed inset-y-0 left-0 w-64 bg-white shadow-xl z-50 transform transition-transform duration-200 ease-in-out md:hidden flex flex-col",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-14 border-b flex items-center justify-between px-4">
          <Link to="/assessments" className="flex items-center gap-2" onClick={closeSidebar}>
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Career Dashboard</span>
          </Link>
          <button onClick={closeSidebar} className="p-1 text-muted-foreground hover:text-foreground border rounded-full shadow-sm bg-white -mr-1">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="px-4 py-4 overflow-y-auto flex-1">
          <p className="text-xs text-muted-foreground mb-4 pl-2">Career</p>
          <nav className="space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = location.pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  to={href}
                  onClick={closeSidebar}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    active
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="p-4 border-t space-y-4">
          {tenant.name && (
            <div className="text-xs text-muted-foreground px-2">
              Tenant: <span className="font-medium text-foreground">{tenant.name}</span>
            </div>
          )}
          <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
