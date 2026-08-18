import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, ChevronRight, Search, LayoutGrid, List, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Vacancy, PaginationMeta } from "@/types";

const VIEW_KEY = "vacancies_view";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [sort, setSort] = useState<string>("newest");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"card" | "list">(
    () => (localStorage.getItem(VIEW_KEY) as "card" | "list") || "card"
  );
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => {
      setQDebounced(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await vacanciesApi.list({
        page,
        per_page: 12,
        q: qDebounced || undefined,
        sort: sort === "newest" ? undefined : (sort as "oldest" | "name"),
      });
      setVacancies(res.data.vacancies ?? []);
      setMeta(res.data.meta ?? null);
    } catch {
      setError(true);
      setVacancies([]);
    } finally {
      setLoading(false);
    }
  }, [page, qDebounced, sort]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const changeSort = (v: string) => {
    setSort(v);
    setPage(1);
  };

  const toggleView = (v: "card" | "list") => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Vacancies</h1>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md overflow-hidden">
            <button
              type="button"
              aria-label="Card view"
              onClick={() => toggleView("card")}
              className={cn("p-2", view === "card" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="List view"
              onClick={() => toggleView("list")}
              className={cn("p-2", view === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={() => navigate("/vacancies/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
          </Button>
        </div>
      </div>

      {/* Search & sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search vacancies..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 w-56"
          />
        </div>
        <Select value={sort} onValueChange={changeSort}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="name">A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load vacancies. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : vacancies.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
          <p className="mb-3">{q ? "No vacancies match your search." : "No vacancies yet."}</p>
          {!q && (
            <Button variant="outline" onClick={() => navigate("/vacancies/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first vacancy
            </Button>
          )}
        </div>
      ) : view === "card" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vacancies.map((v) => {
            const skillList = v.skills ?? [];
            const displaySkills = skillList.slice(0, 3);
            const remaining = skillList.length - displaySkills.length;

            return (
              <Card
                key={v.id}
                className="cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => navigate(`/vacancies/${v.id}/edit`)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{v.role_title}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{skillList.length} skills</span>
                    {v.created_at && (
                      <>
                        <span>·</span>
                        <span>{new Date(v.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                      </>
                    )}
                  </div>
                  {skillList.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {displaySkills.map((s) => (
                        <span
                          key={s.id ?? s.skill_label}
                          className="bg-muted px-1.5 py-0.5 rounded text-xs text-foreground"
                        >
                          {s.skill_label} <span className="text-primary font-medium">L{s.expected_level}</span>
                        </span>
                      ))}
                      {remaining > 0 && (
                        <span className="text-xs text-muted-foreground self-center">
                          +{remaining}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {vacancies.map((v) => {
            const skillList = v.skills ?? [];

            return (
              <Card
                key={v.id}
                className="cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => navigate(`/vacancies/${v.id}/edit`)}
              >
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{v.role_title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{skillList.length} skills</span>
                      {v.created_at && (
                        <>
                          <span>·</span>
                          <span>{new Date(v.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </>
                      )}
                      {skillList.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-xs">{skillList.map((s) => s.skill_label).join(", ")}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Page {meta.current_page} of {meta.total_pages} · {meta.total_count} items
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.total_pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
