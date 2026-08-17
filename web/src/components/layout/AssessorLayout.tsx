import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ClipboardList, Briefcase, LogOut, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

// Candidates comes first because it is the only entry that names a job rather
// than a database table: "who is waiting on me?" Assessments and Vacancies are
// the things you configure once and return to rarely.
const navItems = [
  { href: "/candidates", label: "Candidates", icon: Users },
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

  /**
   * The same three links, laid out for where the hand actually is.
   *
   * Hiding them behind a menu button was never on: Nielsen Norman measured a
   * 20%+ drop in discoverability for hidden navigation and recommends showing
   * links outright at four items or fewer. Three qualifies.
   *
   * Where they sit is the part worth arguing about. On a phone the top of the
   * screen is the hardest place to reach one-handed, which is why both
   * Material and the Human Interface Guidelines put primary destinations at
   * the bottom. So below sm this is a bottom bar in the thumb's path; from sm
   * up, where there is no thumb and no reach problem, it sits inline beside
   * the brand.
   */
  const NavLinks = ({ variant }: { variant: "bar" | "inline" }) => (
    <nav
      className={cn(variant === "bar" ? "flex items-stretch" : "flex items-center gap-1")}
      aria-label="Main"
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = location.pathname.startsWith(href);
        return (
          <Link
            key={href}
            to={href}
            // The active section was signalled by colour alone. Every result
            // screen sits several levels under one of these links, so which one
            // is lit is the only thing telling an assessor which branch they
            // are in.
            aria-current={active ? "page" : undefined}
            className={cn(
              "transition-colors",
              variant === "bar"
                ? // 56px tall clears the 44px minimum touch target with room to
                  // spare, and the label stays: an icon alone is a guess.
                  "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium"
                : "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm",
              active
                ? variant === "bar"
                  ? "text-primary"
                  : "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:text-foreground",
              variant === "inline" && !active && "hover:bg-muted",
            )}
          >
            <Icon className={cn("shrink-0", variant === "bar" ? "h-5 w-5" : "h-4 w-4")} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-background">
        <div className="sticky top-0 z-40 flex h-14 w-full items-center justify-between gap-3 border-b bg-background px-4 sm:border-b-0 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            {/* The wordmark stays at every width. It was hidden on phones back
                when the nav shared this row and space was genuinely tight; the
                nav moved to the bottom bar, so the reason went with it and an
                icon alone left the bar looking unfinished. */}
            <Link to="/candidates" className="flex min-w-0 items-center gap-2">
              <LayoutDashboard className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <span className="truncate text-sm font-semibold">Rakamin AI Interview</span>
            </Link>
            <div className="hidden sm:block">
              <NavLinks variant="inline" />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {tenant.name && (
              <span className="hidden truncate rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground lg:inline">
                Tenant: {tenant.name}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-1.5 h-4 w-4" aria-hidden />
              Logout
            </Button>
          </div>
        </div>

      </header>

      {/* Page content. The shell no longer caps the width — each screen picks
          its own tier through <Page>, because a candidate list and a two-field
          form do not want the same measure. */}
      {/* pb-20 keeps the last row of any list clear of the bottom bar. */}
      <main className="w-full flex-1 px-4 py-6 pb-20 sm:px-6 sm:pb-6">
        <Outlet />
      </main>

      {/* Thumb-zone navigation. Padded for the home indicator so the labels do
          not sit under it on a gesture-bar phone. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
        data-testid="mobile-nav"
      >
        <NavLinks variant="bar" />
      </div>
    </div>
  );
}
