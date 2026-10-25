import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ClipboardList,
  Briefcase,
  LogOut,
  UserCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import ThemeToggle from "@/components/theme/ThemeToggle";

const navItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
];

export default function AssessorLayout() {
  const { email } = useAtomValue(authAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null, email: null });
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/assessments" className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Rakamin AI Interview</span>
            </Link>
            <nav className="flex items-center gap-1">
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
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="Open account menu">
                  <UserCircle className="h-4 w-4 mr-1.5" />
                  Account
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="font-medium">My account</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {email ?? "Signed-in account"}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">My profile</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
