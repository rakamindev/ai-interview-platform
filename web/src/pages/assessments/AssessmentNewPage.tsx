import { useEffect, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/PageHeader";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { vacanciesApi } from "@/services/vacancies";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import { buildAssessmentPrefillFromVacancy } from "@/utils/assessmentFromVacancy";
import type { AssessmentSkill, Vacancy } from "@/types";

export interface AssessmentFormValues {
  name: string;
  time_limit_min: number;
  language: "en" | "id";
  skills: Partial<AssessmentSkill>[];
}

export default function AssessmentNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [vacanciesLoading, setVacanciesLoading] = useState(true);
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      name: "",
      time_limit_min: 45,
      language: "en",
      skills: [],
    },
  });

  const { register, handleSubmit, control, setValue, formState: { errors } } = form;
  const { fields, append, remove, move, replace } = useFieldArray({ control, name: "skills" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await vacanciesApi.list(1);
        if (!cancelled) setVacancies(res.data.vacancies);
      } catch {
        if (!cancelled) setVacancies([]);
      } finally {
        if (!cancelled) setVacanciesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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

  const addCustomSkill = () => {
    append({
      skill_label: "",
      is_custom: true,
      expected_level: 3,
      display_order: fields.length,
    });
  };

  const addB7Skill = (skill: Partial<AssessmentSkill>) => {
    append({ ...skill, display_order: fields.length });
  };

  const importFromVacancy = async (vacancyId: string) => {
    if (!vacancyId) return;

    if (fields.length > 0) {
      const ok = window.confirm(
        "Replace the current skill list with skills from this vacancy? You can still edit after import."
      );
      if (!ok) return;
    }

    setImporting(true);
    setImportNotice(null);
    setError(null);
    try {
      const [vacancyRes, taxonomyRes] = await Promise.all([
        vacanciesApi.get(Number(vacancyId)),
        skillTaxonomiesApi.list(),
      ]);
      const prefill = buildAssessmentPrefillFromVacancy(
        vacancyRes.data.vacancy,
        taxonomyRes.data.skill_taxonomies
      );

      setValue("name", prefill.name, { shouldDirty: true });
      replace(prefill.skills);

      if (prefill.skills.length === 0) {
        setImportNotice(
          "Vacancy has no skills yet. Add skills manually below, or edit the vacancy first."
        );
      } else {
        setImportNotice(
          `Loaded ${prefill.skills.length} skill${prefill.skills.length === 1 ? "" : "s"} from vacancy.`
        );
      }
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to load vacancy.");
    } finally {
      setImporting(false);
    }
  };

  const onSubmit = async (data: AssessmentFormValues) => {
    if (data.skills.length === 0) {
      setError("Add at least one skill to continue.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: data.name,
        time_limit_min: data.time_limit_min,
        language: data.language,
        assessment_skills_attributes: data.skills.map((s, i) => ({
          ...s,
          display_order: i,
        })),
      };
      const res = await assessmentsApi.create(payload);
      navigate(`/assessments/${res.data.assessment.id}/invite`);
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumb={
          <Link
            to="/assessments"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Assessments
          </Link>
        }
        title="New Assessment"
        description="Define skills, time limits, and interview language."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Prefill from vacancy — same field pattern as other selects */}
        <div className="space-y-1.5">
          <Label>Vacancy</Label>
          <Select
            value={selectedVacancyId || undefined}
            onValueChange={(id) => {
              setSelectedVacancyId(id);
              void importFromVacancy(id);
            }}
            disabled={vacanciesLoading || vacancies.length === 0 || importing}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  vacanciesLoading
                    ? "Loading…"
                    : vacancies.length === 0
                      ? "No vacancies yet"
                      : "Select to prefill role title & skills"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {vacancies.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>
                  {v.role_title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {importing && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading vacancy…
            </p>
          )}
          {!importing && importNotice && (
            <p className="text-xs text-muted-foreground">{importNotice}</p>
          )}
        </div>

        {/* Role title */}
        <div className="space-y-1.5">
          <Label htmlFor="name">
            Role title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Senior Frontend Engineer"
            {...register("name", { required: "Role title is required" })}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="flex space-x-6">
          {/* Time limit */}
          <div className="space-y-1.5 flex-1 w-full">
            <Label>
              Session time limit <span className="text-destructive">*</span>
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
                    {min} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Language */}
          <div className="space-y-1.5 flex-1 w-full">
            <Label>Interview language</Label>
            <Select
              defaultValue="en"
              onValueChange={(v) => setValue("language", v as "en" | "id")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="id">Indonesian</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Skills section — existing manual flow unchanged */}
        <div className="space-y-3">
          <Label>Skills to assess</Label>

          {fields.length === 0 ? (
            <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
              <p className="mb-1">No skills added yet.</p>
              <p>Add at least one skill to continue.</p>
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
                <div className="space-y-2">
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

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add from Skill Taxonomy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCustomSkill}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add custom skill
            </Button>
          </div>
        </div>

        <Separator />

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive break-anywhere">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/assessments")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save &amp; Create Session →
          </Button>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={addB7Skill}
      />
    </div>
  );
}
