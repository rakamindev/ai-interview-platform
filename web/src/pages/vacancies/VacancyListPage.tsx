import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ListRow } from "@/components/ui/list-row";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import { formatDate } from "@/utils/datetime";
import type { Vacancy } from "@/types";
import { useRetryFocus } from "@/hooks/useRetryFocus";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    vacanciesApi.list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);
  const { headingRef, markRetry } = useRetryFocus(loading);

  const newButton = (
    <Button asChild>
      <Link to="/vacancies/new"><Plus aria-hidden="true" />New Vacancy</Link>
    </Button>
  );

  return (
    <PageShell>
      <PageHeader ref={headingRef} title="Vacancies" description="Roles and the skill levels they require. A candidate's portfolio is compared against one of these in the fit/gap report."
                  actions={newButton} />

      {loading ? (
        <div aria-busy="true" aria-label="Loading vacancies" className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : error ? (
        <ErrorState title="Could not load vacancies" description="Check your connection, then try again." onRetry={() => { markRetry(); load(); }} />
      ) : vacancies.length === 0 ? (
        <EmptyState icon={Briefcase} title="No vacancies yet" className="bg-card"
                    description="Create a vacancy with its required skill levels to compare candidates against it."
                    action={<Button asChild variant="outline"><Link to="/vacancies/new"><Plus aria-hidden="true" />Create your first vacancy</Link></Button>} />
      ) : (
        <ul className="space-y-2">
          {vacancies.map((v) => (
            <ListRow key={v.id} to={`/vacancies/${v.id}/edit`} title={v.role_title}
                     meta={(v.updated_at ?? v.created_at) && (
                       <span className="flex items-center gap-1"><CalendarDays aria-hidden="true" className="h-3 w-3" />Updated {formatDate(v.updated_at ?? v.created_at)}</span>
                     )} />
          ))}
        </ul>
      )}
    </PageShell>
  );
}
