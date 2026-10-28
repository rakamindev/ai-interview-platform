
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { vacanciesApi } from "@/services/vacancies";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const navigate = useNavigate();

  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadVacancies = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const response = await vacanciesApi.list();
      setVacancies(response.data.vacancies ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVacancies();
  }, [loadVacancies]);

  const filteredVacancies = vacancies.filter((vacancy) =>
    (vacancy.role_title ?? "")
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase()),
  );

  const openNewVacancy = () => navigate("/vacancies/new");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 pb-10">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Recruitment management
          </div>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Vacancies
          </h1>

          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Kelola posisi pekerjaan dan persiapkan kebutuhan rekrutmen tim
            melalui satu dashboard.
          </p>
        </div>

        <Button onClick={openNewVacancy} className="h-10 shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          New vacancy
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Total vacancies
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {loading ? (
                  <Skeleton className="h-7 w-12" />
                ) : error ? (
                  "—"
                ) : (
                  vacancies.length
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Manage your hiring
              </p>
              <p className="mt-1 text-sm font-semibold">
                Keep roles organized
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Select a role to view or edit its details.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">All vacancies</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Loading your vacancies..."
              : error
                ? "Unable to retrieve vacancy data."
                : `${filteredVacancies.length} ${
                    filteredVacancies.length === 1 ? "position" : "positions"
                  } found`}
          </p>
        </div>

        {!loading && !error && vacancies.length > 0 && (
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search vacancies by role title"
              placeholder="Search by role title..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-10 pl-9"
            />
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="flex flex-col gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Failed to load vacancies</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Data lowongan belum dapat dimuat. Periksa koneksi lalu coba
                kembali.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void loadVacancies()}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid gap-3">
          {[1, 2, 3].map((item) => (
            <Card key={item} className="rounded-2xl">
              <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3 max-w-64" />
                  <Skeleton className="h-3 w-1/2 max-w-40" />
                </div>
                <Skeleton className="h-9 w-9 rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Vacancy list */}
      {!loading && !error && (
        <>
          {vacancies.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed px-5 py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Building2 className="h-7 w-7" />
              </div>

              <h3 className="text-lg font-semibold">No vacancies yet</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Mulai dengan membuat lowongan pertama untuk mengatur posisi
                yang sedang dibutuhkan tim rekrutmen.
              </p>

              <Button onClick={openNewVacancy} className="mt-5">
                <Plus className="mr-2 h-4 w-4" />
                Create your first vacancy
              </Button>
            </div>
          ) : filteredVacancies.length === 0 ? (
            <div className="rounded-2xl border border-dashed px-5 py-12 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">No matching vacancies</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Coba kata kunci lain atau hapus pencarian.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => setSearchQuery("")}
              >
                Clear search
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredVacancies.map((vacancy) => (
                <Card
                  key={vacancy.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Edit vacancy ${vacancy.role_title}`}
                  className="group cursor-pointer rounded-2xl transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() =>
                    navigate(`/vacancies/${vacancy.id}/edit`)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/vacancies/${vacancy.id}/edit`);
                    }
                  }}
                >
                  <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                      <BriefcaseBusiness className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold transition-colors group-hover:text-primary">
                        {vacancy.role_title || "Untitled vacancy"}
                      </h3>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          Manage position
                        </span>
                        <span className="hidden text-border sm:inline">•</span>
                        <span>Click to view or edit</span>
                      </div>
                    </div>

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-all group-hover:border-primary/30 group-hover:bg-primary/5 group-hover:text-primary">
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
