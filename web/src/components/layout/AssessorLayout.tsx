import { useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearAuth } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ClipboardList, Briefcase, LogOut, Menu } from "lucide-react";
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
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleLogout = () => {
    clearAuth();
    setAuth({ token: null, user: null });
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-7 min-h-14 h-auto py-2 flex flex-wrap items-center justify-between gap-y-2">
          <div className="flex items-center gap-3 sm:gap-7">
            <Link to="/assessments" className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-[30px] h-[30px] bg-[#0F7B6C] rounded-lg flex items-center justify-center">
                <img src="/assets/logo.jpeg" alt="Logo" />
                {/* <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="1" width="6" height="6" rx="1.5" fill="white" opacity="0.9"/>
                  <rect x="9" y="1" width="6" height="6" rx="1.5" fill="white" opacity="0.6"/>
                  <rect x="1" y="9" width="6" height="6" rx="1.5" fill="white" opacity="0.6"/>
                  <rect x="9" y="9" width="6" height="6" rx="1.5" fill="white" opacity="0.9"/>
                </svg> */}
              </div>
              <span className="font-semibold text-sm text-gray-900">
                Rakamin AI Interview
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-0.5">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = location.pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    to={href}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                      active
                        ? "bg-teal-50 text-teal-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2.5">
            {tenant.name && (
              <span className="hidden md:block text-xs text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-3 py-1 whitespace-nowrap">
                {tenant.name}
              </span>
            )}
            <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
              <AlertDialogTrigger asChild>
                <button className="hidden md:flex items-center gap-1.5 text-[13px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-2.5 py-1.5 rounded-md transition-colors">
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Logout?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to logout from this session?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout}>Logout</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="md:hidden flex items-center justify-center w-9 h-9 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
                  <Menu className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {navItems.map(({ href, label, icon: Icon }) => (
                  <DropdownMenuItem key={href} onSelect={() => navigate(href)}>
                    <Icon className="w-4 h-4 mr-2" />
                    {label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setLogoutOpen(true)}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-7 py-8">
        <Outlet />
      </main>
    </div>
  );
}
