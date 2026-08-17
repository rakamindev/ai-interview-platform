import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ClipboardList,
  Briefcase,
  Users,
  LogOut,
  KeyRound,
  UserRound,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/candidates", label: "Candidates", icon: UserRound },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
];

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const { user } = useAtomValue(authAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null, user: null });
    navigate("/login");
  };

  const navLinkClass = (href: string) =>
    cn(
      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
      location.pathname.startsWith(href)
        ? "bg-primary/10 text-primary font-medium"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header — responsive: nav collapses into a menu below md */}
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/assessments" className="flex items-center gap-2 shrink-0">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm hidden sm:inline">Rakamin AI Interview</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link key={href} to={href} className={navLinkClass(href)}>
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
              {user?.role === "admin" && (
                <Link to="/users" className={navLinkClass("/users")}>
                  <Users className="h-4 w-4" />
                  Users
                </Link>
              )}
            </nav>

            {/* Mobile nav */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="Menu">
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  {navItems.map(({ href, label, icon: Icon }) => (
                    <DropdownMenuItem key={href} onSelect={() => navigate(href)}>
                      <Icon className="h-4 w-4 mr-2" />
                      {label}
                    </DropdownMenuItem>
                  ))}
                  {user?.role === "admin" && (
                    <DropdownMenuItem onSelect={() => navigate("/users")}>
                      <Users className="h-4 w-4 mr-2" />
                      Users
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {tenant.name && (
              <span className="text-xs text-muted-foreground border rounded-full px-2.5 py-0.5 hidden sm:inline-flex">
                Tenant: {tenant.name}
              </span>
            )}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 border rounded-full px-2.5 py-1"
                  >
                    <span className="max-w-24 truncate hidden sm:inline">{user.email}</span>
                    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 capitalize">
                      {user.role}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate("/account")}>
                    <KeyRound className="h-4 w-4 mr-2" />
                    Change password
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      {/* Page content — one consistent width across the app */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
