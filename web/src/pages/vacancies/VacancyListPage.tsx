import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/layout/PageHeader";
import PageTransition from "@/components/layout/PageTransition";
import RowList, { RowListSkeleton } from "@/components/layout/RowList";
import { vacanciesApi } from "@/services/vacancies";
import { Plus } from "lucide-react";
import type { Vacancy } from "@/types";
import ErrorState from "@/components/feedback/ErrorState";
import EmptyState from "@/components/feedback/EmptyState";
import { formatDate } from "@/utils/format";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    vacanciesApi
      .list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <PageTransition className="space-y-6">
      <PageHeader title="Vacancies" subtitle="Roles and the skill levels candidates are compared against.">
        <Button asChild className="min-h-11 sm:min-h-9">
          <Link to="/vacancies/new">
            <Plus className="h-4 w-4" aria-hidden /> New vacancy
          </Link>
        </Button>
      </PageHeader>

      {error ? (
        <ErrorState message="Could not load vacancies. Check your connection and try again." onRetry={load} />
      ) : loading ? (
        <RowListSkeleton />
      ) : vacancies.length === 0 ? (
        <EmptyState
          title="No vacancies yet"
          description="A vacancy lists the skills and levels a role needs. Fit/gap reports compare candidates against it."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/vacancies/new">Create a vacancy</Link>
            </Button>
          }
        />
      ) : (
        <RowList
          label="Vacancies"
          items={vacancies.map((v) => ({
            key: v.id,
            to: `/vacancies/${v.id}/edit`,
            title: v.role_title,
            meta: v.updated_at ? `Updated ${formatDate(v.updated_at)}` : undefined,
          }))}
        />
      )}
    </PageTransition>
  );
}
