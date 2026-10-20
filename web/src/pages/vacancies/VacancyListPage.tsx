import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, ChevronRight } from "lucide-react";
import type { Vacancy } from "@/types";

function VacancyCardItem({
  vacancy,
  index,
  onSelect,
}: {
  vacancy: Vacancy;
  index: number;
  onSelect: () => void;
}) {
  return (
    <div
      className="p-4 space-y-2 cursor-pointer hover:bg-muted/40 transition-colors"
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 bg-muted border text-muted-foreground">
            #{index}
          </span>
          <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{vacancy.role_title}</span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
      {vacancy.created_at && (
        <div className="text-xs text-muted-foreground pl-8">
          Created {new Date(vacancy.created_at).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    vacanciesApi
      .list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Vacancies</h1>
          <p className="text-sm text-muted-foreground">
            Manage job vacancies and skill requirements for candidate evaluation.
          </p>
        </div>
        <Button onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
        </Button>
      </div>

      <Separator />

      {error && (
        <div className="border border-destructive/40 p-4 text-sm text-destructive">
          Failed to load vacancies. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : vacancies.length === 0 ? (
        <div className="border p-12 text-center text-sm text-muted-foreground">
          <p className="mb-3">No vacancies yet.</p>
          <Button variant="outline" onClick={() => navigate("/vacancies/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Create your first vacancy
          </Button>
        </div>
      ) : (
        <>
          {/* Mobile & Tablet card view */}
          <Card className="lg:hidden rounded-none">
            <CardContent className="p-0 divide-y">
              {vacancies.map((v, i) => (
                <VacancyCardItem
                  key={v.id}
                  vacancy={v}
                  index={i + 1}
                  onSelect={() => navigate(`/vacancies/${v.id}/edit`)}
                />
              ))}
            </CardContent>
          </Card>

          {/* Desktop table view */}
          <div className="hidden lg:block bg-card overflow-hidden">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[6%] text-center">#</TableHead>
                  <TableHead className="w-[50%]">Role Title</TableHead>
                  <TableHead className="w-[28%]">Created Date</TableHead>
                  <TableHead className="w-[16%] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vacancies.map((v, i) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-center font-medium text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{v.role_title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {v.created_at ? new Date(v.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/vacancies/${v.id}/edit`)}
                      >
                        Open →
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
