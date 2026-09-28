import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  ClipboardList, 
  Briefcase, 
  LogOut,
  Users,
  BarChart,
  Settings,
  Search,
  Bell,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { Input } from "@/components/ui/input";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
  { href: "#candidates", label: "Candidates", icon: Users },
  { href: "#reports", label: "Reports", icon: BarChart },
  { href: "#settings", label: "Settings", icon: Settings },
];

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-background overflow-hidden text-foreground">
      {/* Sidebar */}
      <aside 
        className={cn(
          "flex flex-col border-r bg-card transition-all duration-300 ease-in-out relative",
          isCollapsed ? "w-[64px]" : "w-[240px]"
        )}
      >
        {/* Logo Area */}
        <div className="h-16 flex items-center justify-center border-b px-4">
          <div className="flex items-center gap-2 overflow-hidden w-full">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-md shrink-0">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            {!isCollapsed && (
              <span className="font-bold text-sm truncate">Rakamin AI</span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 flex flex-col gap-1.5 px-3 overflow-y-auto overflow-x-hidden">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = location.pathname.startsWith(href) && href !== "#";
            return (
              <Link
                key={label}
                to={href.startsWith("#") ? "#" : href}
                title={isCollapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                {!isCollapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer Area (Tenant & Logout) */}
        <div className="p-4 border-t border-border flex flex-col gap-3">
          {tenant.name && !isCollapsed && (
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded-md truncate">
              <span className="font-medium text-foreground block">Tenant</span>
              {tenant.name}
            </div>
          )}
          
          <Button 
            variant="ghost" 
            size={isCollapsed ? "icon" : "default"} 
            onClick={handleLogout}
            className={cn("w-full justify-start text-muted-foreground hover:text-destructive", isCollapsed && "justify-center")}
            title={isCollapsed ? "Logout" : undefined}
          >
            <LogOut className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
            {!isCollapsed && "Logout"}
          </Button>
        </div>

        {/* Collapse Toggle */}
        <Button
          variant="outline"
          size="icon"
          className="absolute -right-4 top-20 h-8 w-8 rounded-full shadow-md z-10 hidden md:flex"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b bg-card flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsCollapsed(!isCollapsed)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="relative max-w-md w-full hidden sm:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search candidates, vacancies..."
                className="w-full bg-muted/50 pl-9 border-none focus-visible:ring-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Bell className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm ml-2">
              A
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-background/50 p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
