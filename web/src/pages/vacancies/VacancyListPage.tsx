import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, ChevronRight, Trash2, Loader2 } from "lucide-react";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Vacancy | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: number; message: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    vacanciesApi.list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const openDeleteDialog = (vacancy: Vacancy) => {
    setDeleteError(null);
    setConfirmTarget(vacancy);
  };

  const handleDelete = async () => {
    if (!confirmTarget) return;
    const id = confirmTarget.id;

    setDeletingId(id);
    setDeleteError(null);
    try {
      await vacanciesApi.delete(id);
      setVacancies((prev) => prev.filter((v) => v.id !== id));
      setConfirmTarget(null);
    } catch (e: any) {
      setDeleteError({
        id,
        message: e?.response?.data?.errors?.[0]?.message ?? "Failed to delete vacancy.",
      });
    } finally {
      setDeletingId(null);
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
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium text-sm">{v.role_title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {deletingId === v.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <button
                      type="button"
                      aria-label={`Delete ${v.role_title}`}
                      disabled={deletingId !== null}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteDialog(v);
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                {deleteError && deleteError.id === v.id && (
                  <p className="text-xs text-destructive mt-2">{deleteError.message}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete vacancy?</AlertDialogTitle>
            <AlertDialogDescription>
              <span>&quot;{confirmTarget?.role_title}&quot; will be permanently deleted.</span>
              {deleteError && deleteError.id === confirmTarget?.id && (
                <span className="mt-2 block text-destructive">{deleteError.message}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
            >
              {deletingId !== null && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}