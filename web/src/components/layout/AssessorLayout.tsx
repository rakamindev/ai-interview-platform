import { Outlet, Link, useNavigate, useLocation } from "react-router-dom"; // Import useLocation
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import CalendarCard from "@/components/common/CalendarCard";
import { cn } from "@/lib/utils";

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation(); // Initialize useLocation
  const isHomePage =
    location.pathname === "/assessments" || location.pathname === "/vacancies"; // Check if current page is /assessments or /vacancies

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-canvas-soft">
      {/* Sidebar */}
      <Sidebar
        onLogout={handleLogout}
        logoIcon={LayoutDashboard}
        logoHref="/assessments"
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col pl-[100px]">
        {" "}
        {/* Adjusted padding to match sidebar width */}
        {isHomePage && (
          <div className="px-14 mt-10">
            <Link to="/assessments" className="flex flex-col">
              <span className="font-semibold text-display-md text-ink">
                Rakamin AI Interview
              </span>
              {tenant.name && (
                <span className="text-body-md text-ink-mute mt-1">
                  Tenant: {tenant.name}
                </span>
              )}
            </Link>
          </div>
        )}
        {/* Content area with two columns */}
        <div
          className={cn(
            "flex-1 flex pr-3 pb-3",
            isHomePage ? "mt-3" : "mt-3 mr-3",
          )}
        >
          <div className={cn("mr-2", isHomePage ? "w-3/4" : "w-full")}>
            <main className="w-full px-6 py-8 bg-canvas-soft rounded-lg">
              <div className="max-w-4xl mx-auto">
                {" "}
                {/* Changed from max-w-7xl */}
                <Outlet />
              </div>
            </main>
          </div>
          {isHomePage && (
            <div className="w-1/4 mb-3 h-[calc(100vh-14px-24px)]">
              <CalendarCard />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
