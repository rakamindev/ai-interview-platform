import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import { AlertTriangle, ArrowUpRight, Briefcase, Plus, Target } from "lucide-react";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true); setError(false);
    vacanciesApi.list().then((res) => setVacancies(res.data.vacancies)).catch(() => setError(true)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  return (
    <div className="space-y-7">
      <section className="rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl"><p className="text-sm font-medium text-primary">Role expectations</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Vacancies</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Define the evidence bar before comparing a candidate. Expected skill levels become the explicit reference for fit/gap analysis.</p></div>
          <Button className="h-11" onClick={() => navigate("/vacancies/new")}><Plus className="mr-2 h-4 w-4" />New vacancy</Button>
        </div>
      </section>

      {error && <div className="flex items-center justify-between rounded-2xl border border-destructive/20 bg-destructive/5 p-4"><span className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />Vacancies could not be loaded.</span><Button variant="outline" size="sm" onClick={load}>Try again</Button></div>}

      {loading ? <div className="grid gap-3 sm:grid-cols-2">{[1,2,3,4].map((i)=><Skeleton key={i} className="h-36 rounded-2xl" />)}</div> : vacancies.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-white p-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Target className="h-5 w-5" /></div><h3 className="mt-4 font-semibold">No role profile yet</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Create a vacancy with expected skills, culture dimensions, and competencies before running fit/gap analysis.</p><Button className="mt-5" onClick={() => navigate("/vacancies/new")}><Plus className="mr-2 h-4 w-4" />Create vacancy</Button></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {vacancies.map((v) => <Card key={v.id} className="group cursor-pointer border-slate-200 shadow-none transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm" onClick={() => navigate(`/vacancies/${v.id}/edit`)}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100"><Briefcase className="h-4 w-4" /></div><ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" /></div><h2 className="mt-5 font-semibold">{v.role_title}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{v.competency_expectations || "No competency expectations documented yet."}</p><div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-slate-100 px-2.5 py-1">{v.skills?.length ?? 0} skills</span><span className="rounded-full bg-slate-100 px-2.5 py-1">Evidence reference</span></div></CardContent></Card>)}
        </div>
      )}
    </div>
  );
}
