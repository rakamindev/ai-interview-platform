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
  arrayMove,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { ArrowLeft, Plus, Loader2, Briefcase, Sparkles } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { vacanciesApi } from "@/services/vacancies";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
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

  // State untuk integrasi Vacancy
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loadingVacancies, setLoadingVacancies] = useState(false);
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>("");

  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      name: "",
      time_limit_min: 45,
      language: "en",
      skills: [],
    },
  });

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = form;
  const { fields, append, remove, move, replace } = useFieldArray({ control, name: "skills" });

  // Ambil daftar lowongan aktif untuk mempermudah recruiter
  useEffect(() => {
    setLoadingVacancies(true);
    vacanciesApi.list()
      .then((res) => {
        setVacancies(res.data.vacancies || []);
      })
      .catch(() => {
        // Abaikan jika gagal memuat lowongan, form tetap bisa digunakan secara manual
      })
      .finally(() => {
        setLoadingVacancies(false);
      });
  }, []);

  // Handler saat recruiter memilih untuk mengimpor dari lowongan
  const handleSelectVacancy = async (val: string) => {
    setSelectedVacancyId(val);
    if (!val || val === "manual") return;

    const targetVacancyId = Number(val);
    try {
      const res = await vacanciesApi.get(targetVacancyId);
      const v = res.data.vacancy;
      if (v) {
        // Otomatis isi Role title dari Vacancy
        setValue("name", v.role_title);

        // Otomatis tarik skill yang ada di Vacancy tersebut
        const skillsList = v.skills || (v as any).vacancy_skills || [];
        if (skillsList.length > 0) {
          const importedSkills: Partial<AssessmentSkill>[] = skillsList.map((vs: any, idx: number) => ({
            skill_id: vs.skill_id,
            skill_label: vs.skill_label,
            is_custom: !vs.skill_id,
            expected_level: vs.expected_level || 3,
            display_order: idx,
            l1_anchor: "Pemahaman dasar awal.",
            l2_anchor: "Mampu menerapkan konsep dengan panduan.",
            l3_anchor: "Mandiri dalam pemecahan masalah.",
            l4_anchor: "Penguasaan mendalam dan optimasi.",
            l5_anchor: "Ahli tingkat lanjut dan arsitektur.",
          }));
          replace(importedSkills);
        }
      }
    } catch {
      // Fallback: gunakan data yang sudah ada di list jika get by id gagal
      const fallback = vacancies.find((x) => x.id === targetVacancyId);
      if (fallback) {
        setValue("name", fallback.role_title);
      }
    }
  };

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
        {/* Opsi Pintas: Impor dari Vacancy */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
          <div className="flex items-center gap-2 text-slate-800">
            <Briefcase className="h-4 w-4 text-teal-600" />
            <Label htmlFor="import-vacancy" className="text-sm font-semibold">
              Hubungkan dengan Lowongan (Vacancy)
            </Label>
          </div>
          <p className="text-xs text-slate-500">
            Pilih lowongan untuk mengisi otomatis judul posisi dan daftar kriteria skill yang dibutuhkan.
          </p>

          <Select
            value={selectedVacancyId}
            onValueChange={handleSelectVacancy}
            disabled={loadingVacancies}
          >
            <SelectTrigger id="import-vacancy" className="w-full bg-white text-sm">
              <SelectValue placeholder={loadingVacancies ? "Memuat daftar lowongan..." : "Pilih lowongan (Opsional)"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">-- Input Manual Tanpa Lowongan --</SelectItem>
              {vacancies.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>
                  {v.role_title} ({v.skills?.length || (v as any).vacancy_skills?.length || 0} skill kriteria)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        {/* Skills section */}
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
