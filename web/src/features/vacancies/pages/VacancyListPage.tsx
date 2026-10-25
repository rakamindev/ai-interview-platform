import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-content";
import EmptyState from "@/components/shared/empty-state";
import { useVacanciesQuery } from "../hooks/useVacanciesQuery";
import { Plus, Briefcase, ChevronRight } from "lucide-react";

export default function VacancyListPage() {
  const { data: vacancies = [], isLoading, isError } = useVacanciesQuery();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacancies"
        subtitle="Define target job profiles, culture expectations, and benchmark competency levels."
      >
        <Button onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
        </Button>
      </PageHeader>

      {isError && (
        <div className="border border-destructive/40 bg-destructive/5 rounded-xl p-4 text-sm text-destructive">
          Failed to load vacancies. Please refresh the page.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : vacancies.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title="No vacancies yet"
          description="Create your first role profile to run Fit/Gap comparison analysis against candidate portfolios."
          actionLabel="Create Vacancy"
          onAction={() => navigate("/vacancies/new")}
        />
      ) : (
        <div className="space-y-2.5">
          {vacancies.map((v) => (
            <Card
              key={v.id}
              className="cursor-pointer hover:border-primary/40 transition-all hover:shadow-xs"
              onClick={() => navigate(`/vacancies/${v.id}/edit`)}
            >
              <CardContent className="py-3.5 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{v.role_title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {v.skills?.length || 0} required competencies
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
