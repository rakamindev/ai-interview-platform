import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, ChevronRight, Trash2, Loader2 } from "lucide-react";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const [vacancyToDelete, setVacancyToDelete] = useState<Vacancy | null>(null);
  const [deleting, setDeleting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchVacancies();
  }, []);

  const fetchVacancies = () => {
    setLoading(true);
    vacanciesApi.list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  const confirmDeleteVacancy = async () => {
    if (!vacancyToDelete) return;
    setDeleting(true);
    try {
      await vacanciesApi.delete(vacancyToDelete.id);
      setVacancies(vacancies.filter((v) => v.id !== vacancyToDelete.id));
      setVacancyToDelete(null);
    } catch (e) {
      setError(true);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Vacancies</h1>
        <Button onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
        </Button>
      </div>

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load or process vacancies. Please refresh the page.
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
              className="hover:border-primary/40 transition-colors"
            >
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div
                  className="flex items-center gap-2 flex-grow cursor-pointer"
                  onClick={() => navigate(`/vacancies/${v.id}/edit`)}
                >
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium text-sm">{v.role_title}</p>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVacancyToDelete(v);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    onClick={() => navigate(`/vacancies/${v.id}/edit`)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!vacancyToDelete} onOpenChange={(open) => !open && setVacancyToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Vacancy "{vacancyToDelete?.role_title}"?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this vacancy? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVacancyToDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteVacancy} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}