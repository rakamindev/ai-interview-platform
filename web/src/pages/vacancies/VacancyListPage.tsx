import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CircleAlert,
  Plus,
  Search,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import type { Vacancy } from "@/types";

function formatDate(value?: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function VacancyCard({
  vacancy,
  onOpen,
}: {
  vacancy: Vacancy;
  onOpen: () => void;
}) {
  const updated = formatDate(vacancy.updated_at);
  const expectations = vacancy.competency_expectations?.trim();
  const dimensions = vacancy.culture_dimensions?.trim();

  return (
    <Card
      className="group flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-none transition-colors duration-150 hover:border-foreground/25 hover:bg-muted/20"
      onClick={onOpen}
    >
      <CardContent className="flex h-full flex-col p-4">
        <div className="mb-4 flex items-start">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
            <BriefcaseBusiness className="size-[18px]" strokeWidth={1.7} />
          </div>
        </div>

        <h2 className="break-words text-base font-semibold leading-snug tracking-tight">
          {vacancy.role_title || "Untitled role"}
        </h2>

        <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-[13px] leading-5 text-muted-foreground">
          {expectations || dimensions || "No role summary added yet."}
        </p>

        {dimensions && expectations && (
          <div className="mt-3">
            <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              Culture defined
            </span>
          </div>
        )}

        <div className="mt-auto pt-4">
          <div className="mb-3 border-t" />
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="min-w-0 text-xs text-muted-foreground">
              {updated ? (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 shrink-0" />
                  Updated {updated}
                </span>
              ) : (
                <span>Role configuration</span>
              )}
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-foreground transition-transform group-hover:translate-x-0.5">
              Open <ArrowUpRight className="size-4" />
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VacancyListPage() {
  const navigate = useNavigate();
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadVacancies = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await vacanciesApi.list();
      setVacancies(response.data.vacancies ?? []);
    } catch {
      setError("Vacancies could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVacancies();
  }, [loadVacancies]);

  const filteredVacancies = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return vacancies;

    return vacancies.filter((vacancy) =>
      [
        vacancy.role_title,
        vacancy.competency_expectations,
        vacancy.culture_dimensions,
        ...(vacancy.skills ?? []).map((skill) => skill.skill_label),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [vacancies, search]);

  const gridClass =
    "grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 lg:px-7">
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <BriefcaseBusiness className="size-4" />
            Recruiter workspace
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Vacancies</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Define role expectations and competencies for candidate assessments.
          </p>
        </div>

        <Button
          className="w-full shrink-0 sm:w-auto"
          onClick={() => navigate("/vacancies/new")}
        >
          <Plus className="mr-2 size-4" />
          Create vacancy
        </Button>
      </header>

      <section className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">
            {loading ? "—" : vacancies.length}
          </span>{" "}
          {vacancies.length === 1 ? "role" : "roles"}
        </p>

        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search roles or skills..."
            aria-label="Search vacancies by role or skill"
            className="h-10 pl-9"
          />
        </div>
      </section>

      {error ? (
        <div className="mt-8 flex flex-col items-start gap-3 rounded-xl border border-destructive/30 p-6">
          <CircleAlert className="size-5 text-destructive" />
          <div>
            <h2 className="font-medium">Unable to load vacancies</h2>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" onClick={() => void loadVacancies()}>
            Try again
          </Button>
        </div>
      ) : loading ? (
        <div className={`${gridClass} mt-5`}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="rounded-xl shadow-none">
              <CardContent className="space-y-4 p-4">
                <Skeleton className="size-9 rounded-lg" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="mt-5 h-px w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredVacancies.length > 0 ? (
        <>
          <p className="mb-3 mt-5 text-sm text-muted-foreground">
            {search.trim()
              ? `${filteredVacancies.length} matching ${
                  filteredVacancies.length === 1 ? "role" : "roles"
                }`
              : "All roles"}
          </p>

          <div className={gridClass}>
            {filteredVacancies.map((vacancy) => (
              <VacancyCard
                key={vacancy.id}
                vacancy={vacancy}
                onOpen={() => navigate(`/vacancies/${vacancy.id}/edit`)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed px-5 py-12 text-center">
          <div className="flex size-11 items-center justify-center rounded-full border bg-background">
            {search.trim() ? (
              <Search className="size-5 text-muted-foreground" />
            ) : (
              <BriefcaseBusiness className="size-5 text-muted-foreground" />
            )}
          </div>
          <h2 className="mt-4 font-semibold">
            {search.trim() ? "No matching roles" : "No vacancies yet"}
          </h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            {search.trim()
              ? "Try another role title or skill."
              : "Create a vacancy to define the competencies used in candidate assessments."}
          </p>
          {search.trim() ? (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setSearch("")}
            >
              Clear search
            </Button>
          ) : (
            <Button
              className="mt-4"
              onClick={() => navigate("/vacancies/new")}
            >
              <Plus className="mr-2 size-4" />
              Create vacancy
            </Button>
          )}
        </div>
      )}

      <footer className="mt-8 border-t pt-4">
        <p className="text-xs leading-5 text-muted-foreground">
          Role expectations define what will be assessed. Missing assessment
          evidence should not be interpreted as a competency gap.
        </p>
      </footer>
    </main>
  );
}
