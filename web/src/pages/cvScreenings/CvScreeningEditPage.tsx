import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { extractErrorMessage } from "@/lib/utils";
import { cvScreeningsApi } from "@/services/cvScreenings";
import { vacanciesApi } from "@/services/vacancies";
import { assessmentsApi } from "@/services/assessments";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { Vacancy, Assessment } from "@/types";

interface CvScreeningFormValues {
  name: string;
  vacancy_id: string;
  assessment_id: string;
  threshold: string;
}

export default function CvScreeningEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, control, setValue, reset } = useForm<CvScreeningFormValues>({
    defaultValues: { name: "", vacancy_id: "", assessment_id: "", threshold: "" },
  });

  const vacancyId = useWatch({ control, name: "vacancy_id" });
  const assessmentId = useWatch({ control, name: "assessment_id" });
  const selectedVacancy = vacancies.find((v) => String(v.id) === vacancyId);
  const vacancyMissingPublicText =
    !!selectedVacancy && !selectedVacancy.public_requirement_text?.trim();

  useEffect(() => {
    Promise.all([cvScreeningsApi.get(Number(id)), vacanciesApi.list(), assessmentsApi.list()])
      .then(([sRes, vRes, aRes]) => {
        setVacancies(vRes.data.vacancies);
        setAssessments(aRes.data.assessments);
        const s = sRes.data.cv_screening;
        reset({
          name: s.name,
          vacancy_id: String(s.vacancy_id),
          assessment_id: String(s.assessment_id),
          threshold: s.threshold != null ? String(s.threshold) : "",
        });
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: CvScreeningFormValues) => {
    if (vacancyMissingPublicText) return;
    setError(null);
    setSubmitting(true);

    const threshold = data.threshold ? Number(data.threshold) : null;

    try {
      await cvScreeningsApi.update(Number(id), {
        name: data.name,
        vacancy_id: Number(data.vacancy_id),
        assessment_id: Number(data.assessment_id),
        threshold,
      });
      navigate(`/cv-screenings/${id}`);
    } catch (e) {
      setError(extractErrorMessage(e, "Failed to save screening."));
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link to={`/cv-screenings/${id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">CV Screening</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">Edit Screening</span>
      </div>

      {loadError && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive mb-6">
          Failed to load this screening. Please refresh the page.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="name">
            Screening name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="e.g. Backend Engineer — Q1 batch"
            {...register("name", { required: true })}
          />
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label>
            Vacancy <span className="text-destructive">*</span>
          </Label>
          {vacancies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No vacancies yet.{" "}
              <Link to="/vacancies/new" className="underline font-medium">
                Create one
              </Link>{" "}
              first.
            </p>
          ) : (
            <Select value={vacancyId} onValueChange={(v) => setValue("vacancy_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a vacancy" />
              </SelectTrigger>
              <SelectContent>
                {vacancies.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.role_title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {vacancyMissingPublicText && (
            <div className="border border-destructive/40 rounded-lg p-3 text-sm text-destructive">
              This vacancy has no public requirement text yet — candidates can't be screened
              against it until you add one.{" "}
              <Link to={`/vacancies/${selectedVacancy!.id}/edit`} className="underline font-medium">
                Edit vacancy
              </Link>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>
            Assessment <span className="text-destructive">*</span>
          </Label>
          {assessments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No assessments yet.{" "}
              <Link to="/assessments/new" className="underline font-medium">
                Create one
              </Link>{" "}
              first.
            </p>
          ) : (
            <Select value={assessmentId} onValueChange={(v) => setValue("assessment_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select an assessment" />
              </SelectTrigger>
              <SelectContent>
                {assessments.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="threshold">Auto-invite threshold (0–100, optional)</Label>
          <Input
            id="threshold"
            type="number"
            min={0}
            max={100}
            placeholder="e.g. 70"
            {...register("threshold")}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to review every candidate manually — no automatic decisions will be made.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(`/cv-screenings/${id}`)}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || vacancyMissingPublicText || !vacancyId || !assessmentId}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
