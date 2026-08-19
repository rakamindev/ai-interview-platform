import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { vacanciesApi } from "@/services/vacancies";
import { useUser } from "@/hooks/useUser";
import { Plus, Briefcase, ChevronRight, Sparkles } from "lucide-react";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const { canEdit } = useUser();

  const fetchVacancies = useCallback(() => {
    setLoading(true);
    setError(false);
    vacanciesApi
      .list()
      .then((res) => setVacancies(res.data.vacancies || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchVacancies();
  }, [fetchVacancies]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Role Vacancies"
        description="Benchmark criteria, competency expectations, and culture fit dimensions."
        actions={
          canEdit && (
            <Button onClick={() => navigate("/vacancies/new")} size="sm">
              <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
            </Button>
          )
        }
      />

      {loading ? (
        <LoadingState rows={4} />
      ) : error ? (
        <ErrorState onRetry={fetchVacancies} title="Failed to load vacancies" />
      ) : vacancies.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No vacancies created yet"
          description="Define role competencies and culture expectations to benchmark candidates."
          actionLabel={canEdit ? "Create Vacancy" : undefined}
          onAction={canEdit ? () => navigate("/vacancies/new") : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vacancies.map((v) => (
            <Card
              key={v.id}
              className="cursor-pointer hover:border-primary/40 transition-all shadow-xs"
              onClick={() => navigate(`/vacancies/${v.id}/edit`)}
            >
              <CardContent className="p-5 flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">{v.role_title}</h3>
                      <span className="text-[11px] text-muted-foreground">
                        {v.skills?.length || 0} benchmark skills
                      </span>
                    </div>
                  </div>

                  {v.competency_expectations && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {v.competency_expectations}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
