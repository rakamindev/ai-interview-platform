import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, User, Sparkles, LayoutDashboard } from "lucide-react";

interface CandidateHeaderProps {
  roleTitle?: string;
}

export const CandidateHeader: React.FC<CandidateHeaderProps> = ({ roleTitle }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const token = localStorage.getItem("auth_token");
  const role = localStorage.getItem("user_role");
  const email = localStorage.getItem("user_email");

  const isAssessor = role === "admin" || role === "assessor";
  const dashboardPath = isAssessor ? "/assessments" : "/candidate";
  const dashboardLabel = isAssessor ? "Assessments" : "Dashboard";

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_email");
    navigate("/login");
  };

  const isInterviewActive = location.pathname.startsWith("/interview/");

  return (
    <header className="border-b bg-white/90 backdrop-blur-md sticky top-0 z-30 shadow-xs">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={token ? dashboardPath : "/login"} className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs transition-transform group-hover:scale-105">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm leading-tight text-foreground">Antigravity</span>
              <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                {roleTitle || "AI Interview Platform"}
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {token && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(dashboardPath)}
              className="text-xs text-muted-foreground hover:text-foreground hidden sm:inline-flex items-center gap-1.5"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>{dashboardLabel}</span>
            </Button>
          )}

          {email && (
            <div className="hidden md:flex items-center gap-2 text-xs font-medium bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full border border-slate-200">
              <User className="h-3.5 w-3.5 text-slate-500" />
              <span className="truncate max-w-[150px]">{email}</span>
            </div>
          )}

          {token ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-xs text-muted-foreground hover:text-destructive"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/login")}
              className="text-xs"
            >
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default CandidateHeader;
