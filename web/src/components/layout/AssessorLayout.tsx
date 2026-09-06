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
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header */}
      {/* The header was `h-14 flex items-center justify-between` with no
          flex-wrap. Its contents — brand, two nav links and the tenant badge
          plus Logout — have a combined min-content width far wider than a phone
          viewport, so the header overflowed horizontally and made the *whole
          document* scroll sideways. `main` is `w-full` (100% of the viewport)
          while the document was wider, which is why every page appeared
          squeezed into a narrow left column with empty space beside it. The
          card layouts were never the cause.

          On small screens the bar now wraps to two rows — brand and Logout on
          the first, navigation on the second — so nothing is hidden and nothing
          overflows. From `sm` up it collapses back to the original single row. */}
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:h-14 sm:flex-nowrap sm:gap-x-6 sm:py-0">
          <Link to="/assessments" className="order-1 flex min-w-0 items-center gap-2">
            <LayoutDashboard className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold">Rakamin AI Interview</span>
          </Link>

          {/* `order-3 w-full` puts navigation on its own row below `sm`, then it
              returns to the brand's side. `overflow-x-auto` keeps it usable if
              more items are added later than a narrow screen can fit. */}
          <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto sm:order-2 sm:w-auto sm:overflow-visible">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                to={href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
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

          <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-3 sm:gap-3">
            {tenant.name && (
              <span className="hidden max-w-[12rem] truncate rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground sm:inline-block">
                Tenant: {tenant.name}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Logout</span>
              <span className="sr-only sm:hidden">Logout</span>
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
