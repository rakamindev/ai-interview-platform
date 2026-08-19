import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusCard } from "@/components/ui/status-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Separator } from "@/components/ui/separator";
import { vacanciesApi } from "@/services/vacancies";
import { LEVEL_LABELS } from "@/utils/constants";
import { formatRelativeTime } from "@/utils/formatRelativeTime";
import {
  Plus, Briefcase, Search, MapPin, Building2, Wallet, CalendarClock,
  Pencil, ArrowLeft, Loader2,
} from "lucide-react";
import type { Vacancy, PaginationMeta } from "@/types";

const WORK_ARRANGEMENT_LABELS: Record<string, string> = {
  onsite: "On-site",
  hybrid: "Hybrid",
  remote: "Remote",
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};

function formatSalary(v: Vacancy) {
  if (!v.salary_visible || (!v.salary_min && !v.salary_max)) return null;
  const fmt = (n: number) => `Rp ${(n / 1_000_000).toFixed(0)}jt`;
  if (v.salary_min && v.salary_max) return `${fmt(v.salary_min)} – ${fmt(v.salary_max)}`;
  return fmt(v.salary_min ?? v.salary_max!);
}

function VacancyDetailPanel({ vacancy, loading, onEdit, onBack }: {
  vacancy: Vacancy | null;
  loading: boolean;
  onEdit: () => void;
  onBack?: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!vacancy) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-12 text-center">
        Select a vacancy to see its details.
      </div>
    );
  }

  const salary = formatSalary(vacancy);

  return (
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to list
        </button>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{vacancy.role_title}</h2>
            {vacancy.closed && (
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                Closed
              </span>
            )}
          </div>
          {vacancy.created_at && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Posted {formatRelativeTime(vacancy.created_at)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
            {(vacancy.city || vacancy.work_arrangement) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {[vacancy.city, vacancy.work_arrangement && WORK_ARRANGEMENT_LABELS[vacancy.work_arrangement]].filter(Boolean).join(" · ")}
              </span>
            )}
            {vacancy.employment_type && (
              <span className="flex items-center gap-1">
                <Briefcase className="h-3 w-3" /> {EMPLOYMENT_TYPE_LABELS[vacancy.employment_type]}
              </span>
            )}
            {vacancy.department && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" /> {vacancy.department}
              </span>
            )}
            {salary && (
              <span className="flex items-center gap-1">
                <Wallet className="h-3 w-3" /> {salary}
              </span>
            )}
            {vacancy.application_deadline && (
              <span className="flex items-center gap-1">
                <CalendarClock className="h-3 w-3" /> Apply by {new Date(vacancy.application_deadline).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
        </Button>
      </div>

      {vacancy.address && (
        <p className="text-sm text-muted-foreground">{vacancy.address}</p>
      )}

      {vacancy.description && (
        <>
          <Separator />
          <div className="space-y-1">
            <p className="text-sm font-medium">Description</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{vacancy.description}</p>
          </div>
        </>
      )}

      {vacancy.skills.length > 0 && (
        <>
          <Separator />
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Expected skills</p>
            <ul className="space-y-1">
              {vacancy.skills.map((s) => (
                <li key={s.id ?? s.skill_label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>•</span>
                  <span>{s.skill_label}</span>
                  <span className="text-xs">(expected {LEVEL_LABELS[s.expected_level]})</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {(vacancy.culture_dimensions || vacancy.competency_expectations) && (
        <>
          <Separator />
          {vacancy.culture_dimensions && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Company culture</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{vacancy.culture_dimensions}</p>
            </div>
          )}
          {vacancy.competency_expectations && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Competency expectations</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{vacancy.competency_expectations}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchList = (targetPage: number) => {
    setLoading(true);
    vacanciesApi.list(targetPage, debouncedSearch || undefined)
      .then((res) => {
        setVacancies(res.data.vacancies);
        setMeta(res.data.meta);
        if (res.data.vacancies.length > 0 && selectedId === null) {
          setSelectedId(res.data.vacancies[0].id);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchList(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    if (page !== 1) {
      setPage(1);
      return;
    }
    fetchList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Load full detail (skills, description, etc.) whenever selection changes.
  useEffect(() => {
    if (selectedId === null) {
      setSelectedVacancy(null);
      return;
    }
    setDetailLoading(true);
    vacanciesApi.get(selectedId)
      .then((res) => setSelectedVacancy(res.data.vacancy))
      .catch(() => setSelectedVacancy(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Vacancies</h1>
        <Button onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
        </Button>
      </div>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search vacancies..."
          className="pl-9 h-11 w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load vacancies. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : vacancies.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
          {debouncedSearch ? (
            <p>No vacancies match "{debouncedSearch}".</p>
          ) : (
            <>
              <p className="mb-3">No vacancies yet.</p>
              <Button variant="outline" onClick={() => navigate("/vacancies/new")}>
                <Plus className="h-4 w-4 mr-1.5" /> Create your first vacancy
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop: list + detail panel side by side */}
          <div className="hidden md:grid md:grid-cols-[320px_1fr] gap-4 items-start">
            <div className="space-y-2">
              {vacancies.map((v) => (
                <StatusCard
                  key={v.id}
                  tone={v.closed ? "neutral" : "primary"}
                  className={`transition-shadow ${selectedId === v.id ? "ring-2 ring-primary shadow-md" : "hover:shadow-md"}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(v.id)}
                    className="w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="font-medium text-sm truncate">{v.role_title}</p>
                        {v.closed && (
                          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">
                            Closed
                          </span>
                        )}
                      </div>
                      {v.city && <p className="text-xs text-muted-foreground mt-1 ml-6">{v.city}</p>}
                    </CardContent>
                  </button>
                </StatusCard>
              ))}
              {meta && <Pagination meta={meta} onPageChange={setPage} />}
            </div>
            <Card className="sticky top-4">
              <CardContent className="p-5">
                <VacancyDetailPanel
                  vacancy={selectedVacancy}
                  loading={detailLoading}
                  onEdit={() => selectedId && navigate(`/vacancies/${selectedId}/edit`)}
                />
              </CardContent>
            </Card>
          </div>

          {/* Mobile: list only, tap to open full-width detail */}
          <div className="md:hidden">
            {selectedId === null ? (
              <div className="space-y-2">
                {vacancies.map((v) => (
                  <StatusCard key={v.id} tone={v.closed ? "neutral" : "primary"}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(v.id)}
                      className="w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <CardContent className="py-3 px-4 flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="font-medium text-sm truncate">{v.role_title}</p>
                      </CardContent>
                    </button>
                  </StatusCard>
                ))}
                {meta && <Pagination meta={meta} onPageChange={setPage} />}
              </div>
            ) : (
              <Card>
                <CardContent className="p-5">
                  {detailLoading && !selectedVacancy ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <VacancyDetailPanel
                      vacancy={selectedVacancy}
                      loading={detailLoading}
                      onEdit={() => selectedId && navigate(`/vacancies/${selectedId}/edit`)}
                      onBack={() => setSelectedId(null)}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
