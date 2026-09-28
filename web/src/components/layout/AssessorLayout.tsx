import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { notify } from "@/components/ui/toast";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import {
  AudioLines,
  ClipboardList,
  Briefcase,
  LogOut,
  Building2,
} from "lucide-react";
import { BreadcrumbProvider, Breadcrumbs } from "./Breadcrumbs";
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
  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    navigate("/login");
    notify("You have been logged out.");
  };
  return (
    <BreadcrumbProvider>
    <AlertDialog>
    <div className="min-h-screen bg-background md:pl-56">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:p-3"
      >
        Skip to content
      </a>
      <aside className="border-b bg-muted/40 md:fixed md:inset-y-0 md:left-0 md:flex md:w-56 md:flex-col md:border-b-0 md:border-r">
        <div className="flex h-16 items-center justify-between px-5">
          <Link
            to="/assessments"
            aria-label="Rakamin AI Interview home"
            className="flex items-center gap-2.5"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <AudioLines className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Rakamin
              <span className="block text-xs font-normal text-muted-foreground">
                AI Interview
              </span>
            </span>
          </Link>
          <AlertDialogTrigger asChild><Button
            className="md:hidden"
            variant="ghost"
            size="icon"
            aria-label="Log out"
          >
            <LogOut />
          </Button></AlertDialogTrigger>
        </div>
        <div className="hidden px-4 pb-6 pt-3 md:block">
          <div className="flex items-center gap-2.5 rounded-md border bg-background p-2.5">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">
                {tenant.name || "Hiring workspace"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Recruiter workspace
              </p>
            </div>
          </div>
        </div>
        <nav
          aria-label="Main navigation"
          className="flex gap-1 px-3 pb-3 md:flex-col"
        >
          <p className="mb-2 hidden px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground md:block">
            Recruitment
          </p>
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              to={href}
              aria-current={
                location.pathname.startsWith(href) ? "page" : undefined
              }
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-150 ease-out",
                location.pathname.startsWith(href)
                  ? "bg-background font-semibold text-foreground ring-1 ring-inset ring-border"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden border-t p-3 md:block">
          <AlertDialogTrigger asChild><Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
          >
            <LogOut /> Log out
          </Button></AlertDialogTrigger>
        </div>
      </aside>
      <Breadcrumbs />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
      >
        <Outlet />
      </main>
    </div>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Log out of your workspace?</AlertDialogTitle><AlertDialogDescription>You will return to the sign-in page. Any unsaved form changes will be lost.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Stay signed in</AlertDialogCancel><AlertDialogAction onClick={handleLogout}>Log out</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </BreadcrumbProvider>
  );
}
