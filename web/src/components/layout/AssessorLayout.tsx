import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom, clearTenant } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Briefcase, ChevronRight, ClipboardList, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/assessments", label: "Assessments", description: "Interview workflows", icon: ClipboardList },
  { href: "/vacancies", label: "Vacancies", description: "Role expectations", icon: Briefcase },
];

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearToken();
    clearTenant();
    setAuth({ token: null });
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50/80 lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="hidden border-r bg-slate-950 text-slate-100 lg:flex lg:min-h-screen lg:flex-col lg:sticky lg:top-0 lg:h-screen">
        <div className="border-b border-white/10 px-5 py-5">
          <Link to="/assessments" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white"><BrainCircuit className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-semibold">AI Interview</p>
              <p className="text-xs text-slate-400">Decision workspace</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <p className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</p>
          {navItems.map(({ href, label, description, icon: Icon }) => {
            const active = location.pathname.startsWith(href);
            return (
              <Link key={href} to={href} className={cn("group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors", active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white")}>
                <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{label}</p><p className="truncate text-[11px] text-slate-500">{description}</p></div>
                <ChevronRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-primary" /><div><p className="text-xs font-medium text-slate-200">Human review required</p><p className="mt-1 text-[11px] leading-4 text-slate-500">AI evidence supports decisions; it does not make them.</p></div></div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-slate-400 hover:bg-white/5 hover:text-white" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur lg:hidden">
          <div className="flex h-16 items-center justify-between px-4">
            <Link to="/assessments" className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" /><span className="text-sm font-semibold">AI Interview</span></Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4" /></Button>
          </div>
          <div className="flex gap-1 overflow-x-auto px-3 pb-3">
            {navItems.map(({ href, label, icon: Icon }) => <Link key={href} to={href} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm", location.pathname.startsWith(href) ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground")}><Icon className="h-4 w-4" />{label}</Link>)}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-6 hidden items-center justify-end lg:flex">
            <div className="rounded-full border bg-white px-3 py-1.5 text-xs text-muted-foreground shadow-sm">Workspace: <span className="font-medium text-foreground">{tenant.name || "Demo Tenant"}</span></div>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
