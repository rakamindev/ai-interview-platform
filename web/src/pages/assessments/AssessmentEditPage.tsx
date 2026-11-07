import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { vacanciesApi } from "@/services/vacancies";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { Vacancy } from "@/types";

export interface AssessmentEditFormValues {
  vacancy_id: string;
  time_limit_min: number;
  language: "en" | "id";
}

export default function AssessmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vacancies, setVacancies] = useState<Vacancy[]>([]);

  const form = useForm<AssessmentEditFormValues>({
    defaultValues: { vacancy_id: "", time_limit_min: 45, language: "en" },
  });

  const { handleSubmit, setValue, reset, watch } = form;
  const selectedVacancyId = watch("vacancy_id");

  useEffect(() => {
    Promise.all([
      assessmentsApi.get(Number(id)),
      vacanciesApi.list(),
    ])
      .then(([assessmentRes, vacanciesRes]) => {
        const a = assessmentRes.data.assessment;
        setVacancies(vacanciesRes.data.vacancies ?? []);
        reset({
          vacancy_id: (a as any).vacancy_id ? String((a as any).vacancy_id) : "",
          time_limit_min: a.time_limit_min,
          language: (a.language as "en" | "id") || "en",
        });
      })
      .catch(() => setError("Failed to load assessment data."))
      .finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: AssessmentEditFormValues) => {
    if (!data.vacancy_id) { setError("Please select a vacancy."); return; }
    setError(null);
    setSubmitting(true);
    try {
      await assessmentsApi.update(Number(id), {
        vacancy_id: data.vacancy_id,
        time_limit_min: data.time_limit_min,
        language: data.language,
      } as any);
      navigate(`/assessments/${id}/invite`);
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAssessment = async () => {
    setDeleting(true);
    try {
      await assessmentsApi.delete(Number(id));
      navigate("/assessments");
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to delete assessment.");
      setDeleteModalOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-2 sm:px-0">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/assessments" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">Back</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">Edit Assessment</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1.5">
          <Label>
            Select Vacancy <span className="text-destructive">*</span>
          </Label>
          <Select
            value={selectedVacancyId}
            onValueChange={(v) => setValue("vacancy_id", v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a vacancy..." />
            </SelectTrigger>
            <SelectContent>
              {vacancies.map((vacancy) => (
                <SelectItem key={vacancy.id} value={String(vacancy.id)}>
                  {vacancy.role_title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>
            Session time limit <span className="text-destructive">*</span>
          </Label>
          <Select
            value={String(form.watch("time_limit_min"))}
            onValueChange={(v) => setValue("time_limit_min", Number(v))}
          >
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIME_LIMIT_OPTIONS.map((min) => (
                <SelectItem key={min} value={String(min)}>{min} min</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Interview language</Label>
          <Select
            value={form.watch("language")}
            onValueChange={(v) => setValue("language", v as "en" | "id")}
          >
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="id">Indonesian</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDeleteModalOpen(true)}
            className="w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4 mr-1.5" /> Delete Assessment
          </Button>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button type="button" variant="outline" onClick={() => navigate(`/assessments/${id}/invite`)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !selectedVacancyId} className="w-full sm:w-auto">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </form>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Are you sure you want to delete this assessment?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the assessment and all of its associated session data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={deleting} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAssessment} disabled={deleting} className="w-full sm:w-auto">
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}