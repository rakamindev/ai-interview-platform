import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import PageHeader from "@/shared/components/PageHeader";
import EmptyState from "@/shared/components/EmptyState";
import ErrorState from "@/shared/components/ErrorState";
import StatCard from "@/shared/components/StatCard";
import StatsGrid from "@/shared/components/StatsGrid";
import StatsGridSkeleton from "@/shared/components/StatsGridSkeleton";
import EntityListCard from "@/shared/components/EntityListCard";
import ListRowSkeleton from "@/shared/components/ListRowSkeleton";
import SearchInput from "@/shared/components/SearchInput";
import Pagination from "@/shared/components/Pagination";
import { vacanciesApi, type VacancyStats } from "@/features/vacancies/services/vacancies";
import { Plus, Briefcase, ListChecks } from "lucide-react";
import type { Vacancy } from "@/features/vacancies/types";
import type { PaginationMeta } from "@/shared/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [stats, setStats] = useState<VacancyStats | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setError(false);
    vacanciesApi.list(page, q)
      .then((res) => {
        setVacancies(res.data.vacancies);
        setMeta(res.data.meta);
        setStats(res.data.stats);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, q]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        title="Vacancies"
        actions={
          <Button onClick={() => navigate("/vacancies/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
          </Button>
        }
      />

      {error ? (
        <ErrorState message="Failed to load vacancies." onRetry={load} />
      ) : (
        <>
          <SearchInput
            placeholder="Search vacancies..."
            onSearch={(value) => {
              setQ(value);
              setPage(1);
            }}
          />

          {loading ? (
            <StatsGridSkeleton columns={2} />
          ) : (
            vacancies.length > 0 && (
              <StatsGrid columns={2}>
                <StatCard icon={Briefcase} label="Total Vacancies" value={meta?.total_count ?? vacancies.length} />
                <StatCard icon={ListChecks} label="Total Skills Tracked" value={stats?.total_skills_tracked ?? 0} accent="secondary" />
              </StatsGrid>
            )
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <ListRowSkeleton key={i} />)}
            </div>
          ) : vacancies.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              message={q ? `No vacancies match "${q}".` : "No vacancies yet."}
              description={q ? "Try a different search term." : "Create your first vacancy to get started."}
              actionLabel={q ? undefined : "Create your first vacancy"}
              onAction={q ? undefined : () => navigate("/vacancies/new")}
            />
          ) : (
            <div className="space-y-3">
              {vacancies.map((v) => (
                <EntityListCard
                  key={v.id}
                  onClick={() => navigate(`/vacancies/${v.id}/edit`)}
                  icon={Briefcase}
                  title={v.role_title}
                  badges={v.skill_labels}
                />
              ))}
            </div>
          )}

          {meta && <Pagination currentPage={meta.current_page} totalPages={meta.total_pages} onPageChange={setPage} />}
        </>
      )}
    </div>
  );
}
