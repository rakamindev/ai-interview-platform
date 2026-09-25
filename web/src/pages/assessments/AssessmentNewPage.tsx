import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Briefcase,
  Sparkles,
  Clock,
  Globe,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { assessmentsApi, AssessmentPayload } from "@/services/assessments";
import { vacanciesApi } from "@/services/vacancies";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentSkill, Vacancy } from "@/types";

export interface AssessmentFormValues {
  name: string;
  time_limit_min: number;
  language: "en" | "id";
  vacancy_id?: string;
  skills: Partial<AssessmentSkill>[];
}

const getDefaultAnchor = (label: string, level: number) => {
  const cleanLabel = label.trim() || "Competency";
  const templates = [
    `Basic awareness and fundamental conceptual understanding of ${cleanLabel}.`,
    `Novice application and practical guided execution of ${cleanLabel}.`,
    `Independent proficiency and standard problem solving in ${cleanLabel}.`,
    `Advanced proficiency and complex troubleshooting in ${cleanLabel}.`,
    `Expert mastery, strategic architecture, and domain leadership in ${cleanLabel}.`,
  ];
  return templates[level - 1] || `Level ${level} competency in ${cleanLabel}.`;
};

export default function AssessmentNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vacancies state
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loadingVacancies, setLoadingVacancies] = useState(true);
  const [autofillMessage, setAutofillMessage] = useState<string | null>(null);

  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      name: "",
      time_limit_min: 45,
      language: "en",
      vacancy_id: "none",
      skills: [],
    },
  });

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = form;
  const { fields, append, remove, move, replace } = useFieldArray({ control, name: "skills" });
  const selectedVacancyId = watch("vacancy_id");

  useEffect(() => {
    vacanciesApi
      .list()
      .then((res) => {
        setVacancies(res.data.vacancies || []);
      })
      .catch((err) => {
        console.error("Failed to load vacancies", err);
      })
      .finally(() => {
        setLoadingVacancies(false);
      });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);
      move(oldIndex, newIndex);
    }
  };

  const handleVacancyChange = async (val: string) => {
    setValue("vacancy_id", val);
    setAutofillMessage(null);

    if (!val || val === "none") {
      return;
    }

    try {
      const vacancyId = Number(val);
      const res = await vacanciesApi.get(vacancyId);
      const v = res.data.vacancy;
      if (!v) return;

      // Auto-populate role title
      setValue("name", v.role_title);

      // Auto-populate skills directly from vacancy with guaranteed anchor strings
      if (v.skills && v.skills.length > 0) {
        const importedSkills: Partial<AssessmentSkill>[] = v.skills.map((s, idx) => ({
          skill_id: s.skill_id as any,
          skill_label: s.skill_label,
          is_custom: !s.skill_id,
          expected_level: s.expected_level || 3,
          l1_anchor: s.l1_anchor?.trim() || getDefaultAnchor(s.skill_label, 1),
          l2_anchor: s.l2_anchor?.trim() || getDefaultAnchor(s.skill_label, 2),
          l3_anchor: s.l3_anchor?.trim() || getDefaultAnchor(s.skill_label, 3),
          l4_anchor: s.l4_anchor?.trim() || getDefaultAnchor(s.skill_label, 4),
          l5_anchor: s.l5_anchor?.trim() || getDefaultAnchor(s.skill_label, 5),
          display_order: idx,
        }));

        replace(importedSkills);
        setAutofillMessage(
          `All ${importedSkills.length} skills & target levels imported from "${v.role_title}". No manual scope entry required.`
        );
      }
    } catch (err) {
      console.error("Failed to fetch vacancy details", err);
    }
  };

  const addSkillFromTaxonomy = (skill: Partial<AssessmentSkill>) => {
    const label = skill.skill_label || "Skill";
    append({
      ...skill,
      expected_level: skill.expected_level ?? 3,
      l1_anchor: skill.l1_anchor?.trim() || getDefaultAnchor(label, 1),
      l2_anchor: skill.l2_anchor?.trim() || getDefaultAnchor(label, 2),
      l3_anchor: skill.l3_anchor?.trim() || getDefaultAnchor(label, 3),
      l4_anchor: skill.l4_anchor?.trim() || getDefaultAnchor(label, 4),
      l5_anchor: skill.l5_anchor?.trim() || getDefaultAnchor(label, 5),
      display_order: fields.length,
    });
  };

  const onSubmit = async (data: AssessmentFormValues) => {
    if (data.skills.length === 0) {
      setError("Please select a target vacancy or add at least one skill.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: AssessmentPayload = {
        name: data.name,
        time_limit_min: Number(data.time_limit_min),
        language: data.language,
        vacancy_id: data.vacancy_id && data.vacancy_id !== "none" ? Number(data.vacancy_id) : null,
        assessment_skills_attributes: data.skills.map((s, i) => {
          const label = s.skill_label || "Skill";
          return {
            skill_id: s.skill_id,
            skill_label: label,
            is_custom: s.is_custom ?? false,
            expected_level: s.expected_level ?? 3,
            l1_anchor: s.l1_anchor?.trim() || getDefaultAnchor(label, 1),
            l2_anchor: s.l2_anchor?.trim() || getDefaultAnchor(label, 2),
            l3_anchor: s.l3_anchor?.trim() || getDefaultAnchor(label, 3),
            l4_anchor: s.l4_anchor?.trim() || getDefaultAnchor(label, 4),
            l5_anchor: s.l5_anchor?.trim() || getDefaultAnchor(label, 5),
            display_order: i,
          };
        }),
      };

      const res = await assessmentsApi.create(payload);
      navigate(`/assessments/${res.data.assessment.id}/invite`);
    } catch (e: any) {
      const errorMsg =
        e?.response?.data?.errors?.[0]?.message ??
        e?.response?.data?.errors?.[0] ??
        e?.response?.data?.error ??
        "Failed to save assessment.";
      setError(typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          to="/assessments"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Assessments</span>
        </Link>
        <span className="text-muted-foreground/60">/</span>
        <span className="font-semibold text-foreground">New Assessment</span>
      </div>

      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Create AI Interview Assessment
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select a target vacancy to automatically import role competencies and benchmark standards.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Step 1: Target Vacancy Connection (Vacancy-Centric Flow) */}
        <Card className="border-[#01959F]/30 dark:border-[#01959F]/40 shadow-sm bg-gradient-to-br from-[#01959F]/5 via-background to-background">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#01959F]/10 dark:bg-[#01959F]/20 text-[#01959F] dark:text-teal-300">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Target Vacancy</CardTitle>
                  <CardDescription className="text-xs">
                    Link assessment to a vacancy to import skill expectations and enable automated Fit/Gap analysis.
                  </CardDescription>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#01959F]/10 text-[#01959F] dark:bg-[#01959F]/20 dark:text-teal-300 border border-[#01959F]/20">
                Primary Step
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select
              value={selectedVacancyId || "none"}
              onValueChange={handleVacancyChange}
              disabled={loadingVacancies}
            >
              <SelectTrigger className="w-full bg-background border-input font-medium">
                <SelectValue placeholder="Select target vacancy..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">-- Select a Target Vacancy --</span>
                </SelectItem>
                {vacancies.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    <span className="font-semibold text-foreground">{v.role_title}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {autofillMessage && (
              <div className="flex items-center gap-2 p-3 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg animate-in fade-in">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{autofillMessage}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Assessment Details */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Assessment Details</CardTitle>
            <CardDescription className="text-xs">
              Role name and candidate session duration parameters.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Role Title */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Role Title / Assessment Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. Senior Backend Engineer"
                className="h-10 text-sm font-medium"
                {...register("name", { required: "Role title is required" })}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Session Settings Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Time limit */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Time Limit <span className="text-destructive">*</span>
                </Label>
                <Select
                  defaultValue="45"
                  onValueChange={(v) => setValue("time_limit_min", Number(v))}
                >
                  <SelectTrigger className="w-full">
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

              {/* Language */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Interview Language
                </Label>
                <Select
                  defaultValue="en"
                  onValueChange={(v) => setValue("language", v as "en" | "id")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="id">Bahasa Indonesia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Skills Imported from Vacancy */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Competencies &amp; Skills Evaluated</CardTitle>
                  <CardDescription className="text-xs">
                    Skills imported directly from vacancy. Recruiter does not need to define scope or anchor manually.
                  </CardDescription>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                {fields.length} {fields.length === 1 ? "skill" : "skills"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 ? (
              <div className="border border-dashed rounded-xl p-8 text-center bg-muted/20">
                <Sparkles className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="font-semibold text-sm text-foreground">No skills imported yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Select a Target Vacancy above to automatically import all required skills and target levels.
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2.5">
                    {fields.map((field, index) => (
                      <SkillCard
                        key={field.id}
                        id={field.id}
                        index={index}
                        form={form}
                        onRemove={() => remove(index)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hover:border-primary/50 text-xs"
                onClick={() => setPickerOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5 text-primary" />
                Add Additional Skill from Taxonomy
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hover:border-primary/50 text-xs"
                onClick={() =>
                  append({
                    skill_label: "",
                    is_custom: true,
                    expected_level: 3,
                    display_order: fields.length,
                  })
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1.5 text-primary" />
                Add Custom Skill
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-xs text-destructive font-medium">
            {error}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/assessments")}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="px-5 shadow-md shadow-[#01959F]/20 bg-[#01959F] hover:bg-[#007E86] text-white font-semibold transition-all hover:shadow-lg hover:shadow-[#01959F]/30"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving Assessment...
              </>
            ) : (
              "Save & Create Session →"
            )}
          </Button>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={addSkillFromTaxonomy}
      />
    </div>
  );
}
