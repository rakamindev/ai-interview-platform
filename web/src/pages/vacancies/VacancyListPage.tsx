import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
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
    <main>
      <PageHeader
        title="Vacancies"
        description="Roles used to generate fit/gap reports against candidate portfolios."
        actions={
          <Button onClick={() => navigate("/vacancies/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
          </Button>
        }
      />

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive mb-4">
          Failed to load vacancies. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : vacancies.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No vacancies yet"
          description="Create a vacancy to compare candidate portfolios against required skills."
          actionLabel="Create your first vacancy"
          onAction={() => navigate("/vacancies/new")}
        />
      ) : (
        <div className="space-y-2">
          {vacancies.map((v) => (
            <Link
              key={v.id}
              to={`/vacancies/${v.id}/edit`}
              className="block rounded-xl border bg-card text-card-foreground shadow hover:border-primary/40 hover:shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <div className="py-3 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium text-sm">{v.role_title}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
