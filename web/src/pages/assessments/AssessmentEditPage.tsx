import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { LEVEL_TIERS } from "@/components/assessment/LevelRadio";
import { ArrowLeft, Loader2, ClipboardList, Briefcase, Layers, ExternalLink, AlertCircle } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { vacanciesApi } from "@/services/vacancies";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { Vacancy } from "@/types";

export default function AssessmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assessment, setAssessment] = useState<any>(null);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>("");
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);
  const [timeLimitMin, setTimeLimitMin] = useState<number>(45);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      assessmentsApi.get(Number(id)),
      vacanciesApi.list(1),
    ])
      .then(async ([assessmentRes, vacanciesRes]) => {
        if (!mounted) return;
        const a = assessmentRes.data.assessment;
        setAssessment(a);
        setTimeLimitMin(a.time_limit_min || 45);

        const vacList = vacanciesRes.data.vacancies || [];
        setVacancies(vacList);

        // Find matching vacancy by role title
        const matched = vacList.find(
          (v) => v.role_title.trim().toLowerCase() === a.name.trim().toLowerCase()
        );

        if (matched) {
          setSelectedVacancyId(String(matched.id));
          try {
            const fullVac = await vacanciesApi.get(matched.id);
            if (mounted) setSelectedVacancy(fullVac.data.vacancy);
          } catch {
            // fallback
          }
        } else if (vacList.length > 0) {
          // If no exact match, don't force-select another vacancy unless user chooses
        }
      })
      .catch(() => {
        if (mounted) setError("Failed to load assessment details.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  const handleSelectVacancy = async (vacId: string) => {
    setSelectedVacancyId(vacId);
    if (!vacId) return;
    try {
      const res = await vacanciesApi.get(Number(vacId));
      setSelectedVacancy(res.data.vacancy);
    } catch {
      // ignore
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // If user changed vacancy role, update name & skills from that vacancy
      if (selectedVacancy && selectedVacancy.role_title !== assessment?.name) {
        const existingSkillIds: number[] = (assessment?.skills || [])
          .map((s: any) => s.id)
          .filter(Boolean);
        const destroyAttrs = existingSkillIds.map((sid) => ({ id: sid, _destroy: true }));
        const newSkillAttrs = (selectedVacancy.skills || []).map((s, idx) => {
          const label = s.skill_label || "this competency";
          return {
            skill_id: s.skill_id,
            skill_label: s.skill_label,
            expected_level: s.expected_level,
            is_custom: !s.skill_id,
            display_order: idx,
            l1_anchor: s.l1_anchor || `Demonstrates foundational understanding of ${label} with guidance.`,
            l2_anchor: s.l2_anchor || `Applies ${label} independently for standard requirements.`,
            l3_anchor: s.l3_anchor || `Executes complex ${label} tasks proficiently with consistent quality.`,
            l4_anchor: s.l4_anchor || `Shows advanced mastery of ${label}, guiding peers and optimizing approaches.`,
            l5_anchor: s.l5_anchor || `Demonstrates expert, strategic command of ${label} across the organization.`,
          };
        });

        await assessmentsApi.update(Number(id), {
          name: selectedVacancy.role_title,
          time_limit_min: timeLimitMin,
          assessment_skills_attributes: [
            ...destroyAttrs,
            ...newSkillAttrs,
          ],
        });
      } else {
        // Only duration is modified (role title & skills preserved from vacancy)
        await assessmentsApi.update(Number(id), {
          time_limit_min: timeLimitMin,
        });
      }

      navigate(`/assessments/${id}/invite`);
    } catch (err: any) {
      setError(err?.response?.data?.errors?.[0]?.message || "Failed to update assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-12">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  // Display skills: from selected vacancy if chosen, or assessment's existing skills
  const displaySkills = selectedVacancy?.skills || assessment?.skills || [];

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link to={`/assessments/${id}/invite`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">Back to Details</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">Edit Assessment</span>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Edit Assessment
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Update interview duration or switch role from available Vacancies. Skills are managed strictly in Vacancies.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Role Title — Bound to Vacancies only, no raw text editing */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <Briefcase className="h-4 w-4 text-primary" />
              Role Title (from Vacancies) <span className="text-destructive">*</span>
            </Label>
            {vacancies.length > 0 ? (
              <Select value={selectedVacancyId} onValueChange={handleSelectVacancy}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select a vacancy role..." />
                </SelectTrigger>
                <SelectContent>
                  {vacancies.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.role_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-2.5 rounded-lg border bg-slate-50 text-xs font-semibold text-slate-800">
                {assessment?.name || "No role specified"}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Role titles belong to Vacancies. You can select another available vacancy role.
            </p>
          </div>

          {/* Session Duration — Only freely editable assessment setting */}
          <div className="space-y-1.5 max-w-xs">
            <Label className="text-sm font-semibold">
              Interview Duration <span className="text-destructive">*</span>
            </Label>
            <Select
              value={String(timeLimitMin)}
              onValueChange={(v) => setTimeLimitMin(Number(v))}
            >
              <SelectTrigger className="bg-white">
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
            <p className="text-[11px] text-muted-foreground">
              Total duration allowed for the AI interview session.
            </p>
          </div>

          <Separator />

          {/* Notice: Skills cannot be modified here */}
          <div className="rounded-lg bg-sky-50/80 border border-sky-200/80 p-3.5 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
            <div className="text-xs text-sky-900 space-y-1">
              <p className="font-semibold">Skills are managed in Vacancies</p>
              <p className="text-sky-700 leading-relaxed">
                Skills and competency expectations cannot be modified directly inside an assessment. To add, edit, or adjust skills, please modify the vacancy role.
              </p>
              {selectedVacancyId ? (
                <div className="pt-1">
                  <Link
                    to={`/vacancies/${selectedVacancyId}/edit`}
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    Modify skills in Vacancies <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <div className="pt-1">
                  <Link
                    to="/vacancies"
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    Go to Vacancies <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Read-only Skills List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  Skills to Assess ({displaySkills.length})
                </Label>
                <p className="text-xs text-muted-foreground">
                  Inherited from <span className="font-semibold text-slate-700">{selectedVacancy?.role_title || assessment?.name}</span>
                </p>
              </div>
            </div>

            {displaySkills.length > 0 ? (
              <div className="flex flex-col gap-2">
                {displaySkills.map((s: any, idx: number) => {
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
                        {s.scope_include && (
                          <span className="text-[11px] text-muted-foreground block truncate">
                            {s.scope_include}
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
                No skills configured for this role.
              </div>
            )}
          </div>

          <Separator />

          {/* Form Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/assessments/${id}/invite`)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
