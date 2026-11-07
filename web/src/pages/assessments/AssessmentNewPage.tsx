import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2 } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { vacanciesApi } from "@/services/vacancies";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { Vacancy } from "@/types"; 

export interface AssessmentFormValues {
  vacancy_id: string; 
  time_limit_min: number;
  language: "en" | "id";
}

export default function AssessmentNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loadingVacancies, setLoadingVacancies] = useState(true);

  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      vacancy_id: "",
      time_limit_min: 45,
      language: "en",
    },
  });

  const { handleSubmit, setValue, watch } = form;
  const selectedVacancyId = watch("vacancy_id");

  useEffect(() => {
    setLoadingVacancies(true);
    vacanciesApi
      .list()
      .then((res) => setVacancies(res.data.vacancies ?? []))
      .catch((err) => console.error("Failed to fetch vacancies", err))
      .finally(() => setLoadingVacancies(false));
  }, []);

  const onSubmit = async (data: AssessmentFormValues) => {
    if (!data.vacancy_id) {
      setError("Please select a vacancy to continue.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        vacancy_id: data.vacancy_id,
        time_limit_min: data.time_limit_min,
        language: data.language,
      };
      const res = await assessmentsApi.create(payload as any);
      navigate(`/assessments/${res.data.assessment.id}/invite`);
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link to="/assessments" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">Back</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">New Assessment</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1.5">
          <Label>
            Select Vacancy <span className="text-destructive">*</span>
          </Label>
          <Select
            onValueChange={(v) => setValue("vacancy_id", v)}
            disabled={loadingVacancies}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={loadingVacancies ? "Loading vacancies..." : "Select a vacancy..."} />
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

        {/* Time limit */}
        <div className="space-y-1.5">
          <Label>
            Session time limit <span className="text-destructive">*</span>
          </Label>
          <Select
            defaultValue="45"
            onValueChange={(v) => setValue("time_limit_min", Number(v))}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_LIMIT_OPTIONS.map((min) => (
                <SelectItem key={min} value={String(min)}>
                  {min} min
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Language */}
        <div className="space-y-1.5">
          <Label>Interview language</Label>
          <Select
            defaultValue="en"
            onValueChange={(v) => setValue("language", v as "en" | "id")}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="id">Indonesian</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/assessments")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !selectedVacancyId}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save &amp; Create Session →
          </Button>
        </div>
      </form>
    </div>
  );
}