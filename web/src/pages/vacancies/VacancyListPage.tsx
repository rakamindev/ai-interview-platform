import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, ChevronRight, Search } from "lucide-react";
import { LEVEL_LABELS } from "@/utils/constants";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    vacanciesApi
      .list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vacancies;
    return vacancies.filter(
      (v) =>
        v.role_title.toLowerCase().includes(q) ||
        (v.skills ?? []).some((s) => s.skill_label.toLowerCase().includes(q)),
    );
  }, [vacancies, query]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Vacancies</h1>
        <Button onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
        </Button>
      </div>

      {vacancies.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by role title or skill..."
            className="pl-9"
            aria-label="Search vacancies"
          />
        </div>
      )}

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
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
        <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
          <p className="mb-3">No vacancies yet.</p>
          <Button variant="outline" onClick={() => navigate("/vacancies/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Create your first vacancy
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No vacancies match "{query}".
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((v) => (
            <Card
              key={v.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => navigate(`/vacancies/${v.id}/edit`)}
            >
              <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{v.role_title}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {(v.skills ?? []).length > 0 ? (
                        (v.skills ?? []).map((s) => (
                          <span
                            key={s.id ?? s.skill_label}
                            className="inline-flex items-center gap-1 text-xs bg-muted rounded px-1.5 py-0.5"
                          >
                            {s.skill_label}
                            <span className="text-muted-foreground">
                              {LEVEL_LABELS[s.expected_level]}
                            </span>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">No skills configured</span>
                      )}
                    </div>
                    {v.culture_dimensions && (
                      <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                        {v.culture_dimensions}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
