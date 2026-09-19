import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PageHead from "@/components/design/PageHead";
import LevelChip from "@/components/design/LevelChip";
import Banner from "@/components/design/Banner";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, ChevronRight } from "lucide-react";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    vacanciesApi
      .list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHead
        title="Vacancies"
        subtitle="Open roles you run interviews against. Connect an assessment to each one."
      >
        <Button onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4" /> New Vacancy
        </Button>
      </PageHead>

      {error && <Banner tone="fail">Failed to load vacancies. Please refresh the page.</Banner>}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-[86px] w-full rounded-[14px]" />
          ))}
        </div>
      ) : vacancies.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-card p-12 text-center">
          <span className="mx-auto mb-3 grid h-[52px] w-[52px] place-items-center rounded-full border border-dashed border-[var(--border-strong)] text-faint">
            <Briefcase className="h-5 w-5" />
          </span>
          <h3 className="font-display text-[15px] font-semibold text-foreground">
            No vacancies yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-[340px] text-sm text-muted-foreground">
            Create a vacancy to define the skills and levels you are hiring for.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/vacancies/new")}>
            <Plus className="h-4 w-4" /> Create your first vacancy
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {vacancies.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => navigate(`/vacancies/${v.id}/edit`)}
              className="group flex w-full items-center gap-[18px] rounded-[14px] border border-border bg-card px-5 py-[18px] text-left transition-all hover:border-brand hover:shadow-md active:translate-y-px"
            >
              <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-deep">
                <Briefcase className="h-[19px] w-[19px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[15px] font-semibold tracking-tight text-foreground">
                  {v.role_title}
                </div>
                {v.skills.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    {v.skills.map((skill, i) => (
                      <span key={skill.id ?? i} className="inline-flex items-center gap-1.5">
                        <LevelChip level={skill.expected_level} />
                        <span className="text-xs text-muted-foreground">{skill.skill_label}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="flex shrink-0 items-center gap-3.5">
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {v.skills.length} skill{v.skills.length === 1 ? "" : "s"}
                </span>
                <span className="grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors group-hover:bg-brand-soft group-hover:text-brand-deep">
                  <ChevronRight className="h-4 w-4" />
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
