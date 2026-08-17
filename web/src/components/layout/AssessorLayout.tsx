import { useEffect, useState } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { authApi } from "@/services/auth";
import { sessionsApi, type LiveSessionSummary } from "@/services/sessions";
import { LayoutDashboard, ClipboardList, Briefcase, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

const navItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
];

const LIVE_POLL_MS = 30000;

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();
  const [liveSessions, setLiveSessions] = useState<LiveSessionSummary[]>([]);
  const [identity, setIdentity] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchLive = () => {
      sessionsApi
        .live()
        .then((res) => {
          if (!cancelled) setLiveSessions(res.data.sessions);
        })
        .catch(() => {});
    };
    fetchLive();
    const interval = setInterval(fetchLive, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    authApi
      .me()
      .then((res) => {
        const u = res.data.user;
        setIdentity(u.email ?? (u.role ? `Role: ${u.role}` : null));
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    void navigate("/login");
  };

  const firstLive = liveSessions[0];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header */}
      <header className="border-b bg-white sticky top-0 z-40">
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
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
              <span className="text-xs text-muted-foreground border rounded-full px-2.5 py-0.5">
                Tenant: {tenant.name}
              </span>
            )}
            {identity && (
              <span
                className="text-xs text-muted-foreground max-w-[160px] truncate"
                title={identity}
              >
                {identity}
              </span>
            )}
            {firstLive && (
              <Link
                to={`/assessments/${firstLive.assessment_id}/sessions/${firstLive.id}/monitor`}
                className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-full px-2.5 py-0.5 hover:bg-primary/5 transition-colors"
                title={`${liveSessions.length} live session${liveSessions.length !== 1 ? "s" : ""}`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
                  aria-hidden="true"
                />
                {liveSessions.length} live
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1.5" />
              Logout
            </Button>
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
