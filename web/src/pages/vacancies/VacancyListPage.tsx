import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import VacancyFormDialog from "@/components/vacancy/VacancyFormDialog";
import ListToolbar from "@/components/workspace/ListToolbar";
import MetricStrip from "@/components/workspace/MetricStrip";
import PaginationControls from "@/components/workspace/PaginationControls";
import { vacanciesApi } from "@/services/vacancies";
import { showRequestError } from "@/lib/requestToast";
import { BarChart3, Briefcase, Edit3, Plus, RefreshCw, Sparkles } from "lucide-react";
import type { PaginationMeta, Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ current_page: 1, total_pages: 1, total_count: 0, per_page: 20 });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; id?: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadVacancies = () => {
    setLoading(true);
    setError(false);
    vacanciesApi.list({ page, search })
      .then((res) => { setVacancies(res.data.vacancies); setMeta(res.data.meta ?? { current_page: page, total_pages: 1, total_count: res.data.vacancies.length, per_page: res.data.vacancies.length }); })
      .catch((requestError) => { setError(true); showRequestError(requestError, "Couldn’t load vacancies."); })
      .finally(() => setLoading(false));
  };

  useEffect(loadVacancies, [page, search]);

  const cultureReady = useMemo(() => vacancies.filter((vacancy) => vacancy.culture_dimensions || vacancy.competency_expectations).length, [vacancies]);

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary"><Briefcase className="mr-1.5 h-3 w-3" />Role library</Badge>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Vacancies</h1>
          <p className="mt-1 text-sm text-muted-foreground">Shape the role requirements used by fit/gap analysis.</p>
        </div>
        <Button className="h-11" onClick={() => setDialog({ mode: "create" })}><Plus className="h-4 w-4" /> New vacancy</Button>
      </div>

      <MetricStrip items={[
        { label: "Total vacancies", value: meta.total_count, icon: BarChart3, className: "text-foreground" },
        { label: "With skill scope", value: vacancies.filter((vacancy) => vacancy.skills?.length).length, icon: Briefcase, className: "text-primary" },
        { label: "Culture context", value: cultureReady, icon: Sparkles, className: "text-secondary-foreground" },
        { label: "Showing", value: vacancies.length, icon: BarChart3, className: "text-muted-foreground" },
      ]} />

      <ListToolbar search={searchInput} onSearchChange={setSearchInput} searchPlaceholder="Search vacancies by role title" resultCount={vacancies.length} />

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-28 w-full rounded-2xl" />)}</div>
      ) : error ? (
        <div className="flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/5 p-5" role="alert">
          <div><p className="font-medium text-destructive">Failed to load vacancies. Please refresh the page.</p><p className="mt-1 text-sm text-muted-foreground">Retry without losing your search.</p></div>
          <Button variant="outline" onClick={loadVacancies}><RefreshCw className="h-4 w-4" /> Retry</Button>
        </div>
      ) : vacancies.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">{search ? "No vacancies match this search." : "No vacancies yet."}</p>
          <p className="mt-1 text-sm text-muted-foreground">Create a role to make fit/gap analysis available.</p>
          {search ? <Button variant="outline" className="mt-4" onClick={() => setSearchInput("")}>Clear search</Button> : <Button className="mt-4" onClick={() => setDialog({ mode: "create" })}><Plus className="h-4 w-4" /> Create your first vacancy</Button>}
        </div>
      ) : (
        <div className="space-y-3">
          {vacancies.map((vacancy) => (
            <Card key={vacancy.id} className="rounded-2xl border-border/80 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">{vacancy.role_title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><span>{vacancy.skill_count ?? vacancy.skills?.length ?? 0} skill requirements</span><span>{vacancy.culture_dimensions || vacancy.competency_expectations ? "AI narrative context ready" : "No culture context yet"}</span></div>
                </div>
                <Button variant="outline" className="h-10 shrink-0" onClick={() => setDialog({ mode: "edit", id: vacancy.id })}><Edit3 className="h-4 w-4" /> Edit</Button>
              </CardContent>
            </Card>
          ))}
          <PaginationControls meta={meta} onPageChange={setPage} />
        </div>
      )}

      <VacancyFormDialog mode={dialog?.mode ?? "create"} vacancyId={dialog?.id} open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }} onSaved={loadVacancies} />
    </div>
  );
}
