import { ClipboardList, Briefcase, LogOut, Menu, LayoutDashboard } from "lucide-react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
];

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      {/* Premium Top Header */}
      <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-40 supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-black" />
            <span className="font-bold text-zinc-900 tracking-tight text-lg">
              Rakamin<span className="text-zinc-500 font-normal"> AI Interview</span>
            </span>
          </div>

          {/* Right Side: Burger Menu & Profile */}
          <div className="flex items-center gap-4">
            {tenant.name && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-zinc-700">
                  {tenant.name}
                </span>
              </div>
            )}

            {/* Burger Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-zinc-200 bg-white hover:bg-zinc-100 hover:text-zinc-900 shadow-sm transition-all">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl border-zinc-200 shadow-xl p-2">
                <DropdownMenuLabel className="font-medium text-xs text-zinc-500 px-2 py-1.5">
                  Navigation
                </DropdownMenuLabel>

                {navItems.map(({ href, label, icon: Icon }) => (
                  <DropdownMenuItem key={href} asChild>
                    <Link
                      to={href}
                      className={cn(
                        "flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors mb-1",
                        location.pathname.startsWith(href)
                          ? "bg-zinc-100 text-zinc-900 font-medium"
                          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", location.pathname.startsWith(href) ? "text-zinc-900" : "text-zinc-400")} />
                      {label}
                    </Link>
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator className="my-1.5 bg-zinc-100" />

                <DropdownMenuLabel className="font-medium text-xs text-zinc-500 px-2 py-1.5 hidden sm:block">
                  Account
                </DropdownMenuLabel>

                {/* Mobile Tenant Name Fallback */}
                {tenant.name && (
                  <div className="sm:hidden px-2 py-2 mb-1 rounded-lg bg-zinc-50 text-xs text-zinc-500 flex items-center gap-2 border border-zinc-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {tenant.name}
                  </div>
                )}

                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
