import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/shared/EmptyState";
import { ListRowCard } from "@/components/shared/ListRowCard";
import { ListControls, ListScroll } from "@/components/shared/ListControls";
import { vacanciesApi } from "@/services/vacancies";
import { matchesQuery, collectAllPages } from "@/utils/listQuery";
import { Plus, Briefcase } from "lucide-react";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setError(false);
    collectAllPages(async (page) => {
      const res = await vacanciesApi.list(page);
      return {
        items: res.data.vacancies,
        totalPages: res.data.meta?.total_pages ?? 1,
      };
    })
      .then(setVacancies)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => vacancies.filter((v) => matchesQuery(v.role_title, search)),
    [vacancies, search]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacancies"
        description="Role expectations used for fit-gap comparison against candidate portfolios."
        actions={
          <Button onClick={() => navigate("/vacancies/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
          </Button>
        }
      />

      {error && (
        <ErrorState
          title="Failed to load vacancies"
          description="Check your connection and try again."
          onRetry={load}
        />
      )}

      {!error && loading && <LoadingBlock rows={2} />}

      {!error && !loading && vacancies.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title="No vacancies yet"
          description="Add a vacancy with expected skill levels to unlock fit-gap reports."
          action={
            <Button variant="outline" onClick={() => navigate("/vacancies/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first vacancy
            </Button>
          }
        />
      )}

      {!error && !loading && vacancies.length > 0 && (
        <div className="space-y-3">
          <ListControls
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search vacancies"
            showStatus={false}
          />

          {filtered.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No matching vacancies"
              description="Try a different role title."
            />
          ) : (
            <ListScroll className="space-y-2 pr-1">
              {filtered.map((v) => (
                <ListRowCard
                  key={v.id}
                  onClick={() => navigate(`/vacancies/${v.id}/edit`)}
                  title={
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="break-anywhere">{v.role_title}</span>
                    </span>
                  }
                  meta={
                    <span>
                      Updated{" "}
                      {v.updated_at
                        ? new Date(v.updated_at).toLocaleDateString()
                        : "—"}
                    </span>
                  }
                />
              ))}
            </ListScroll>
          )}
        </div>
      )}
    </div>
  );
}
