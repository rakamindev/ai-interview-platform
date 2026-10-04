import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import Pagination from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, ChevronRight, Search } from "lucide-react";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError(false);

    vacanciesApi
      .list(page, search, perPage)
      .then((res) => {
        setVacancies(res.data.vacancies);
        setTotalPages(res.data.meta.total_pages);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [page, search, perPage]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Vacancies</h1>
        <Button onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
        </Button>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Show</span>

          <Select
            value={String(perPage)}
            onValueChange={(value) => {
              setPerPage(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
            </SelectContent>
          </Select>

          <span>data</span>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search vacancies..."
            className="pl-9"
          />
        </div>
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
          <p className="mb-3">No vacancies yet.</p>
          <Button variant="outline" onClick={() => navigate("/vacancies/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Create your first vacancy
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {vacancies.map((v) => (
            <Card
              key={v.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => navigate(`/vacancies/${v.id}/edit`)}
            >
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium text-sm">{v.role_title}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
