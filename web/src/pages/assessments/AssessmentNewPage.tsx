import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LEVEL_TIERS } from "@/components/assessment/LevelRadio";
import { ArrowLeft, Loader2, ClipboardList, Briefcase, Plus, CheckCircle2, Layers } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { vacanciesApi } from "@/services/vacancies";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { Vacancy } from "@/types";
import { EMPLOYMENT_TYPE_LABELS, WORKPLACE_TYPE_LABELS } from "@/types";

export default function AssessmentNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Note #31: Assessment skills are ONLY sourced from Vacancies (no manual skill builder here)
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loadingVacancies, setLoadingVacancies] = useState(true);
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>("");
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);

  const [timeLimitMin, setTimeLimitMin] = useState<number>(45);

  useEffect(() => {
    vacanciesApi.list()
      .then((res) => {
        const list = res.data.vacancies || [];
        setVacancies(list);
        if (list.length > 0) {
          handleSelectVacancy(String(list[0].id));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingVacancies(false));
  }, []);

  const handleSelectVacancy = async (id: string) => {
    setSelectedVacancyId(id);
    if (!id) {
      setSelectedVacancy(null);
      return;
    }
    try {
      const res = await vacanciesApi.get(Number(id));
      setSelectedVacancy(res.data.vacancy);
    } catch {
      setSelectedVacancy(null);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVacancy) {
      setError("Please select a vacancy role.");
      return;
    }
    if (!selectedVacancy.skills || selectedVacancy.skills.length === 0) {
      setError("The selected vacancy does not have any skills configured. Please edit the vacancy first to add skills.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      // Map skills directly from the chosen Vacancy with guaranteed anchors
      const payload = {
        name: selectedVacancy.role_title,
        time_limit_min: timeLimitMin,
        language: "en" as const,
        assessment_skills_attributes: selectedVacancy.skills.map((s, i) => {
          const label = s.skill_label || "this competency";
          return {
            skill_id: s.skill_id,
            skill_label: s.skill_label,
            expected_level: s.expected_level,
            is_custom: !s.skill_id,
            display_order: i,
            l1_anchor: s.l1_anchor || `Demonstrates foundational understanding of ${label} with guidance.`,
            l2_anchor: s.l2_anchor || `Applies ${label} independently for standard requirements.`,
            l3_anchor: s.l3_anchor || `Executes complex ${label} tasks proficiently with consistent quality.`,
            l4_anchor: s.l4_anchor || `Shows advanced mastery of ${label}, guiding peers and optimizing approaches.`,
            l5_anchor: s.l5_anchor || `Demonstrates expert, strategic command of ${label} across the organization.`,
          };
        }),
      };

      const res = await assessmentsApi.create(payload);
      navigate(`/assessments/${res.data.assessment.id}/invite`);
    } catch (err: any) {
      setError(err?.response?.data?.errors?.[0]?.message ?? "Failed to create assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingVacancies) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-12">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link to="/assessments" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">Assessments</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">New Assessment</span>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Create Assessment
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Select a target vacancy role to assess. Skill requirements and competency thresholds are inherited directly from the vacancy.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {error}
          </div>
        )}

        {vacancies.length === 0 ? (
          <div className="border border-dashed rounded-xl p-8 text-center space-y-3 bg-slate-50/50">
            <Briefcase className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <div>
              <p className="text-sm font-semibold text-slate-800">No Vacancies Available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Assessments require a Vacancy as the source of skills and requirements. Please create a vacancy first.
              </p>
            </div>
            <Button onClick={() => navigate("/vacancies/new")} size="sm">
              <Plus className="h-4 w-4 mr-1.5" /> Create Vacancy First
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Step 1: Select Vacancy Role (Note #31) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-primary" />
                Select Vacancy Role <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedVacancyId} onValueChange={handleSelectVacancy}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Choose a vacancy role..." />
                </SelectTrigger>
                <SelectContent>
                  {vacancies.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.role_title} ({EMPLOYMENT_TYPE_LABELS[v.employment_type || "full_time"] || "Full-time"} · {WORKPLACE_TYPE_LABELS[v.workplace_type || "on_site"] || "On-site"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                The role title and required skills will be bound to this vacancy.
              </p>
            </div>

            {/* Step 2: Session Duration */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">
                Interview Duration <span className="text-destructive">*</span>
              </Label>
              <Select
                value={String(timeLimitMin)}
                onValueChange={(v) => setTimeLimitMin(Number(v))}
              >
                <SelectTrigger className="bg-white max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_LIMIT_OPTIONS.map((min) => (
                    <SelectItem key={min} value={String(min)}>
                      {min} minutes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Step 3: Inherited Skills Preview (Read-only, managed in Vacancy per Note #20 & #31) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-primary" />
                    Skills to Assess ({selectedVacancy?.skills?.length || 0})
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Sourced directly from <span className="font-semibold text-slate-800">{selectedVacancy?.role_title || "the selected vacancy"}</span>{selectedVacancy ? ` (${EMPLOYMENT_TYPE_LABELS[selectedVacancy.employment_type || "full_time"] || "Full-time"} · ${WORKPLACE_TYPE_LABELS[selectedVacancy.workplace_type || "on_site"] || "On-site"})` : ""}.
                  </p>
                </div>
                {selectedVacancy && (
                  <Link
                    to={`/vacancies/${selectedVacancy.id}/edit`}
                    className="text-xs text-primary hover:underline font-medium"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Edit in Vacancies ↗
                  </Link>
                )}
              </div>

              {selectedVacancy?.skills && selectedVacancy.skills.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {selectedVacancy.skills.map((s, idx) => {
                    const tier = LEVEL_TIERS[s.expected_level] || {
                      code: `L${s.expected_level}`,
                      name: "Proficient",
                      desc: "",
                    };

                    return (
                      <div
                        key={s.id ?? idx}
                        className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/60 flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <span className="font-semibold text-xs text-slate-800 block truncate">
                            {s.skill_label}
                          </span>
                          {tier.desc && (
                            <span className="text-[11px] text-muted-foreground block truncate">
                              {tier.desc}
                            </span>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-primary/10 text-primary border-primary/20 shrink-0 px-2 py-0.5"
                        >
                          {tier.code} · {tier.name}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="border border-dashed rounded-lg p-5 text-center text-xs text-muted-foreground bg-slate-50/50">
                  No skills attached to this vacancy. Please add skills in the Vacancy menu first.
                </div>
              )}
            </div>

            <Separator />

            {/* Form Actions */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/assessments")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !selectedVacancy?.skills?.length}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Assessment & Add Candidates →
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
