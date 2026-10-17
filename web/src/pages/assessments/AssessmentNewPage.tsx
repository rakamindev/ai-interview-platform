import { useState } from "react";
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
import { ArrowLeft, Plus, Loader2, Clock, Globe } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentSkill } from "@/types";
import HeroBanner from "@/components/common/HeroBanner";

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

  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      name: "",
      time_limit_min: 45,
      language: "en",
      skills: [],
    },
  });

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "skills" });

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
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
        <Link to="/assessments" className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-xs text-slate-500">Assessments</span>
        <span className="text-xs text-slate-400">/</span>
        <span className="text-xs font-bold text-slate-900">Buat Assessment Baru</span>
      </div>

      {/* Hero Banner */}
      <HeroBanner
        badgeText="⭐️ Assessment & Rubric Builder"
        title="Rancang Technical Assessment Baru"
        highlightText="Rubrik B7"
        subtitle="Tentukan judul role, batas waktu wawancara, bahasa pengantar, dan susun kriteria anchor level L1 hingga L5."
        bulletPoints={[
          "Pilihan taksonomi kompetensi terstandar B7 atau kustom",
          "Dukungan drag-and-drop urutan probing wawancara",
          "Batas waktu adaptif (30 s/d 90 menit) dengan graceful exit",
        ]}
        imageSrc="/images/program.png"
        imageAlt="Rakamin New Assessment Planning"
        imageFloatingBadge={{
          title: "B7 Rubric Matrix",
          subtitle: "Standardized Anchors",
        }}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Card 1: Main Configuration */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-[#01959f]" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
              Konfigurasi Utama Sesi Assessment
            </h3>
          </div>

          {/* Role title */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Judul Role / Posisi <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Contoh: Senior Frontend Engineer"
              className="h-12 text-sm sm:text-base font-semibold rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
              {...register("name", { required: "Judul role wajib diisi" })}
            />
            {errors.name && (
              <p className="text-xs text-destructive font-medium">{errors.name.message}</p>
            )}
          </div>

          {/* 2-col for Time Limit and Language */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-2">
              <Label className="h-5 flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Batas Waktu Sesi (Menit) <span className="text-destructive">*</span></span>
              </Label>
              <Select
                defaultValue="45"
                onValueChange={(v) => setValue("time_limit_min", Number(v))}
              >
                <SelectTrigger className="w-full h-12 rounded-xl text-sm font-semibold bg-slate-50/50 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {TIME_LIMIT_OPTIONS.map((min) => (
                    <SelectItem key={min} value={String(min)} className="font-medium text-sm">
                      {min} menit {min === 45 ? "(Standar Rakamin)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="h-5 flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Bahasa Wawancara AI</span>
              </Label>
              <Select
                defaultValue="en"
                onValueChange={(v) => setValue("language", v as "en" | "id")}
              >
                <SelectTrigger className="w-full h-12 rounded-xl text-sm font-semibold bg-slate-50/50 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="en" className="font-medium text-sm">English (Global Standard)</SelectItem>
                  <SelectItem value="id" className="font-medium text-sm">Bahasa Indonesia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Card 2: Skills section */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#fbc036]" />
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Rubrik Kompetensi Standar B7
              </h3>
            </div>
            <span className="text-xs font-semibold bg-teal-50 text-[#01808a] px-2.5 py-0.5 rounded-full border border-teal-100">
              {fields.length} Rubrik Terpilih
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Tentukan kriteria rubrik teknis yang akan dievaluasi. Anda dapat mengurutkan prioritas probing pertanyaan AI interviewer dengan drag-and-drop.
          </p>

          {fields.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2 bg-slate-50/50">
              <p className="text-sm font-semibold text-slate-700">Belum ada rubrik kompetensi dipilih</p>
              <p className="text-xs text-slate-500">
                Pilih minimal 1 skill dari taksonomi kompetensi standar B7 atau tambahkan skill kustom.
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
                <div className="space-y-3">
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

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPickerOpen(true)}
              className="w-full sm:w-auto flex-1 rounded-xl text-xs sm:text-sm font-semibold h-11 min-h-[44px] px-4 border-[#01959f]/40 text-[#01959f] hover:bg-teal-50 justify-center shadow-2xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Pilih dari Taksonomi B7
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={addCustomSkill}
              className="w-full sm:w-auto flex-1 rounded-xl text-xs sm:text-sm font-semibold h-11 min-h-[44px] px-4 border-slate-200 hover:bg-slate-50 justify-center shadow-2xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Tambah Skill Kustom
            </Button>
          </div>
        </div>

        {error && (
          <div className="border border-destructive/30 rounded-xl p-4 bg-destructive/5 text-sm text-destructive font-medium">
            {error}
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-center sm:justify-end gap-3 pt-3 w-full">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl h-11 px-6 font-semibold"
            onClick={() => navigate("/assessments")}
          >
            Batal
          </Button>
          <Button
            type="submit"
            variant="cta"
            className="rounded-xl h-11 px-6 font-bold shadow-xs"
            disabled={submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Simpan &amp; Buat Sesi →
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
