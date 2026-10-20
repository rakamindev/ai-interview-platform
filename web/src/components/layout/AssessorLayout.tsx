import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ClipboardList, Briefcase, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

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
    <div className="min-h-screen flex flex-col bg-[#F7F9FA] text-[#1F2937]">
      {/* Top header */}
      <header className="border-b border-[#E2E8F0] bg-white sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 min-h-14 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 min-w-0">
            <Link to="/assessments" className="flex items-center gap-2 shrink-0">
              <LayoutDashboard className="h-5 w-5 text-[#0F8F95] shrink-0" />
              <span className="font-semibold text-sm tracking-tight text-[#1F2937]">
                Talent Assessment Workspace
              </span>
            </Link>
            <nav aria-label="Main navigation" className="flex items-center gap-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm transition-colors",
                    location.pathname.startsWith(href)
                      ? "bg-[#0F8F95]/10 text-[#0B7479] font-medium"
                      : "text-[#64748B] hover:bg-[#F7F9FA] hover:text-[#1F2937]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {tenant.name && (
              <span className="hidden sm:inline-flex items-center text-xs text-[#64748B] bg-[#F7F9FA] border border-[#E2E8F0] rounded-full px-2.5 py-0.5 max-w-[180px] truncate">
                Workspace: {tenant.name}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 px-2.5 text-xs sm:text-sm">
              <LogOut className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden xs:inline sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-[1200px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
