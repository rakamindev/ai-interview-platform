import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { vacanciesApi } from "@/services/vacancies";
import { ArrowLeft, Plus, Trash2, Loader2, Briefcase, Sparkles, MapPin } from "lucide-react";
import type { VacancySkill, AssessmentSkill, EmploymentType, WorkplaceType } from "@/types";

interface VacancyEditFormValues {
  role_title: string;
  employment_type: EmploymentType;
  workplace_type: WorkplaceType;
  culture_dimensions: string;
  skills: Partial<VacancySkill>[];
}

export default function VacancyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deletedSkillIds, setDeletedSkillIds] = useState<number[]>([]);

  const { register, handleSubmit, control, setValue, reset, watch, formState: { errors } } = useForm<VacancyEditFormValues>({
    defaultValues: {
      role_title: "",
      employment_type: "full_time",
      workplace_type: "on_site",
      culture_dimensions: "",
      skills: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  useEffect(() => {
    let mounted = true;
    vacanciesApi
      .get(Number(id))
      .then((res) => {
        if (!mounted) return;
        const v = res.data.vacancy;
        reset({
          role_title: v.role_title,
          employment_type: v.employment_type || "full_time",
          workplace_type: v.workplace_type || "on_site",
          culture_dimensions: v.culture_dimensions || "",
          skills: v.skills || [],
        });
      })
      .catch(() => {
        if (mounted) setError("Failed to load vacancy details.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, reset]);

  const handleRemoveSkill = (index: number) => {
    const skillToRemove = watch(`skills.${index}`);
    if (skillToRemove?.id) {
      setDeletedSkillIds((prev) => [...prev, skillToRemove.id as number]);
    }
    remove(index);
  };

  const addB7Skill = (skill: Partial<AssessmentSkill>) => {
    append({
      skill_id: skill.skill_id,
      skill_label: skill.skill_label || "",
      expected_level: 3,
    });
  };

  const addCustomSkill = () => {
    append({
      skill_id: undefined,
      skill_label: "",
      expected_level: 3,
    });
  };

  const onSubmit = async (data: VacancyEditFormValues) => {
    if (data.skills.length === 0) {
      setError("Please include at least one skill for this vacancy.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const remainingSkills = data.skills.map((s) => ({
        id: s.id,
        skill_id: s.skill_id || undefined,
        skill_label: s.skill_label,
        expected_level: s.expected_level || 3,
      }));

      const destroyedSkills = deletedSkillIds.map((did) => ({
        id: did,
        _destroy: true,
      }));

      await vacanciesApi.update(Number(id), {
        role_title: data.role_title,
        employment_type: data.employment_type || "full_time",
        workplace_type: data.workplace_type || "on_site",
        culture_dimensions: data.culture_dimensions,
        competency_expectations: "",
        vacancy_skills_attributes: [
          ...remainingSkills,
          ...(destroyedSkills as any),
        ],
      });

      navigate("/vacancies");
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message || e?.response?.data?.error || "Failed to update vacancy.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Breadcrumb / Back button */}
      <div className="flex items-center gap-2">
        <Link to="/vacancies" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">Vacancies</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">Edit Vacancy</span>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Edit Vacancy
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Update role title, competency expectations (Beginner to Expert), and company culture parameters.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Role Title */}
          <div className="space-y-1.5">
            <Label htmlFor="role_title" className="text-sm font-semibold">
              Role Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="role_title"
              placeholder="e.g. Senior Product Engineer"
              className={errors.role_title ? "border-destructive" : ""}
              {...register("role_title", { required: "Role title is required" })}
            />
          </div>

          {/* Employment Type & Workplace Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="employment_type" className="text-sm font-semibold flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-slate-500" />
                Employment Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch("employment_type") || "full_time"}
                onValueChange={(val) => setValue("employment_type", val as EmploymentType)}
              >
                <SelectTrigger id="employment_type" className="bg-white">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="part_time">Part-time</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Work engagement status (e.g. Full-time, Contract, Part-time).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="workplace_type" className="text-sm font-semibold flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-slate-500" />
                Workplace Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch("workplace_type") || "on_site"}
                onValueChange={(val) => setValue("workplace_type", val as WorkplaceType)}
              >
                <SelectTrigger id="workplace_type" className="bg-white">
                  <SelectValue placeholder="Select workplace..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_site">On-site</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Work location setup (e.g. On-site, Online, Hybrid).
              </p>
            </div>
          </div>

          <Separator />

          {/* Expected Skills Section — Note #35: Tombol cukup di DALAM kotak */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-semibold">Expected Skills & Competency Levels</Label>
              <p className="text-xs text-muted-foreground">
                Specify expected mastery levels from L1 (Beginner) to L5 (Expert).
              </p>
            </div>

            {fields.length === 0 ? (
              <div className="border border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground bg-slate-50/50 space-y-3">
                <Sparkles className="h-6 w-6 mx-auto text-primary/40 mb-1.5" />
                <div>
                  <p className="font-medium text-xs text-slate-700">No skills attached to this vacancy.</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Choose skills from the catalog or define custom competencies for this role.
                  </p>
                </div>
                {/* Note #35: Tombol di dalam kotak */}
                <div className="flex items-center justify-center gap-2.5 pt-1">
                  <Button type="button" size="sm" variant="outline" className="text-xs border-primary/30 text-primary hover:bg-primary/5" onClick={() => setPickerOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Choose Skills
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const currentLevel = watch(`skills.${index}.expected_level`) ?? 3;
                  const isTaxonomy = !!watch(`skills.${index}.skill_id`);

                  return (
                    <div
                      key={field.id}
                      className="border border-slate-200/90 rounded-lg p-4 space-y-3 bg-white shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                        {isTaxonomy ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-sm text-slate-900 truncate">
                              {watch(`skills.${index}.skill_label`)}
                            </span>
                            <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground bg-slate-50">
                              SK-{watch(`skills.${index}.skill_id`)}
                            </Badge>
                          </div>
                        ) : (
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs font-semibold text-slate-700">
                              Custom Skill Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              placeholder="e.g. Communication, Problem Solving, Product Architecture"
                              className="text-sm bg-slate-50/50"
                              {...register(`skills.${index}.skill_label`, { required: true })}
                            />
                          </div>
                        )}
                        {!isTaxonomy && (
                          <Badge variant="secondary" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200 shrink-0">
                            Custom
                          </Badge>
                        )}
                      </div>

                      {/* Level Selection with Beginner–Expert */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-xs font-medium text-slate-700">
                          Expected Proficiency Level:
                        </span>
                        <LevelRadio
                          value={currentLevel}
                          onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
                          detailed={true}
                        />
                      </div>

                      {/* Delete button at the bottom */}
                      <div className="flex justify-end pt-2 border-t border-slate-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2.5 text-xs text-destructive hover:bg-rose-50 hover:text-destructive"
                          onClick={() => handleRemoveSkill(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Delete Skill
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {/* Note #35: Tombol tambah skill di dalam section */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs border-primary/30 text-primary hover:bg-primary/5"
                    onClick={() => setPickerOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Choose Skills
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Team Context & Squad Dynamics (Optional - Discussion #3) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="culture_dimensions" className="text-sm font-semibold">
                Team & Squad Dynamics <span className="text-muted-foreground font-normal text-xs">(Optional)</span>
              </Label>
              <span className="text-[11px] text-muted-foreground">Inherits Settings by default</span>
            </div>
            <Textarea
              id="culture_dimensions"
              rows={3}
              placeholder="e.g. Squad operates in 1-week rapid agile sprints with close cross-functional collaboration with Product & Design..."
              {...register("culture_dimensions")}
            />
            <p className="text-[11px] text-muted-foreground">
              Optional role-specific team context. If left blank, the AI interviewer automatically inherits the general Company Culture defined in Settings.
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/vacancies")}
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

      {/* Skill Picker Dialog */}
      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(skill) => {
          addB7Skill(skill);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
