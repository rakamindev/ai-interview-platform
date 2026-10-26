import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, ChevronRight } from "lucide-react";
import type { Vacancy } from "@/types";
import { ROLE_TITLE_OPTIONS } from "@/utils/roleTitles";

const levelLabels: Record<NonNullable<Vacancy["experience_level"]>, string> = {
  intern: "Intern", associate: "Associate", mid: "Mid-level", senior: "Senior", lead: "Lead",
};
const arrangementLabels: Record<NonNullable<Vacancy["work_arrangement"]>, string> = {
  onsite: "Onsite", hybrid: "Hybrid", remote: "Remote",
};
const employmentLabels: Record<NonNullable<Vacancy["employment_type"]>, string> = {
  full_time: "Full-time", contract: "Contract", internship: "Internship",
};
const formatIdr = (amount?: number | null) => amount == null ? null : `Rp${new Intl.NumberFormat("id-ID").format(amount)}`;

function VacancyMetadata({ vacancy: v }: { vacancy: Vacancy }) {
  const workplace = [v.location, v.work_arrangement && arrangementLabels[v.work_arrangement], v.employment_type && employmentLabels[v.employment_type]].filter(Boolean);
  const experience = [v.experience_level && levelLabels[v.experience_level], v.experience_years_min != null || v.experience_years_max != null ? `${v.experience_years_min ?? 0}–${v.experience_years_max ?? "∞"} years` : null].filter(Boolean).join(" · ");
  const salary = v.salary_min != null || v.salary_max != null ? `${formatIdr(v.salary_min) ?? "-"} – ${formatIdr(v.salary_max) ?? "-"}` : null;

  return <div className="mt-2.5 space-y-1.5 border-t pt-2.5 text-sm text-foreground">
    {workplace.length > 0 && <p className="break-words">{workplace.join(" · ")}</p>}
    {(experience || v.minimum_education) && <p className="flex flex-wrap gap-x-2 gap-y-0.5">{experience && <span>{experience}</span>}{v.minimum_education && <span>· {v.minimum_education}</span>}</p>}
    {v.skill_labels?.length ? <p className="break-words border-t pt-2">{v.skill_labels.join(" · ")}</p> : null}
    {salary && <p className="border-t pt-2 font-medium text-foreground">{salary}</p>}
  </div>;
}

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { vacanciesApi.list().then((res) => setVacancies(res.data.vacancies)).catch(() => setError(true)).finally(() => setLoading(false)); }, []);

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h1 className="text-xl font-semibold">Vacancies</h1><Button className="w-full sm:w-auto" onClick={() => navigate("/vacancies/new")}><Plus className="mr-1.5 h-4 w-4" /> New Vacancy</Button></div>
    {error && <div className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">Failed to load vacancies. Please refresh the page.</div>}
    {loading ? <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full sm:h-32" />)}</div> : vacancies.length === 0 ? <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground sm:p-12"><p className="mb-3">No vacancies yet.</p><Button className="w-full sm:w-auto" variant="outline" onClick={() => navigate("/vacancies/new")}><Plus className="mr-1.5 h-4 w-4" /> Create your first vacancy</Button></div> : <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">{vacancies.map((v) => <Card key={v.id} className="cursor-pointer transition-colors hover:border-primary/40" onClick={() => navigate(`/vacancies/${v.id}/edit`)}><CardContent className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-4 sm:py-4"><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" /><p className="break-words text-base font-semibold leading-snug">{v.role_title}</p>{!ROLE_TITLE_OPTIONS.includes(v.role_title as typeof ROLE_TITLE_OPTIONS[number]) && <span className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">Custom</span>}</div><VacancyMetadata vacancy={v} /></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></CardContent></Card>)}</div>}
  </div>;
}
