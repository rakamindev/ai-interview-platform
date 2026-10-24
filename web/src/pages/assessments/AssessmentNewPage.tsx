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
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Sparkles,
  Clock,
  Globe2,
  Layers,
  FileCode2,
  Award,
  Sliders,
} from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentSkill } from "@/types";

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
      setError("Pilih atau tambahkan minimal 1 skill kompetensi untuk dinilai.");
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
      setError(e?.response?.data?.errors?.[0]?.message ?? "Gagal menyimpan asesmen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/assessments"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-[#01959f] transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 group-hover:border-[#01959f]/40 flex items-center justify-center transition-all">
            <ArrowLeft className="h-4 w-4" />
          </div>
          <span>Kembali ke Daftar Asesmen</span>
        </Link>
      </div>

      {/* Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-[#01959f] text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Interview Setup Studio</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Buat Asesmen Baru
          </h1>
          <p className="text-sm text-slate-500">
            Konfigurasi profil role jabatan, durasi wawancara suara AI, dan rubrik kompetensi terstandarisasi.
          </p>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50/70 rounded-2xl p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Card 1: Pengaturan Utama Role & Sesi */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#01959f] flex items-center justify-center">
              <FileCode2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Informasi & Parameter Wawancara</h2>
              <p className="text-xs text-slate-500">Identitas instrumen wawancara dan alokasi waktu bicara AI.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Role Title / Judul Posisi <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Contoh: Senior Frontend Engineer, Data Scientist"
              className="h-11 rounded-xl border-slate-200 focus:border-[#01959f]"
              {...register("name", { required: "Role title wajib diisi" })}
            />
            {errors.name && (
              <p className="text-xs text-red-500 font-medium">{errors.name.message}</p>
            )}
          </div>

          {/* Grid: Waktu & Bahasa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#01959f]" />
                Batas Waktu Sesi Wawancara <span className="text-red-500">*</span>
              </Label>
              <Select
                defaultValue="45"
                onValueChange={(v) => setValue("time_limit_min", Number(v))}
              >
                <SelectTrigger className="h-11 rounded-xl border-slate-200 focus:border-[#01959f] bg-slate-50/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {TIME_LIMIT_OPTIONS.map((min) => (
                    <SelectItem key={min} value={String(min)}>
                      {min} Menit Wawancara
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Globe2 className="h-3.5 w-3.5 text-[#01959f]" />
                Bahasa Pengantar AI
              </Label>
              <Select
                defaultValue="en"
                onValueChange={(v) => setValue("language", v as "en" | "id")}
              >
                <SelectTrigger className="h-11 rounded-xl border-slate-200 focus:border-[#01959f] bg-slate-50/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="en">English (Global Technical)</SelectItem>
                  <SelectItem value="id">Bahasa Indonesia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Card 2: Pemetaan Rubrik Kompetensi */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#01959f] flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">Rubrik Kompetensi yang Dinilai</h2>
                  <span className="bg-teal-50 text-[#01959f] text-xs font-bold px-2 py-0.5 rounded-full border border-teal-200/60">
                    {fields.length} Skill
                  </span>
                </div>
                <p className="text-xs text-slate-500">AI akan menguji setiap skill sesuai level behavioral anchor yang dipilih.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
                className="rounded-xl border-[#01959f]/30 text-[#01959f] hover:bg-teal-50 text-xs font-semibold h-9 px-3.5"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Dari Taksonomi B7
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCustomSkill}
                className="rounded-xl border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold h-9 px-3.5"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Skill Kustom
              </Button>
            </div>
          </div>

          {fields.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-2xl p-10 text-center bg-slate-50/50 space-y-3">
              <Award className="h-8 w-8 text-slate-400 mx-auto" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Belum Ada Skill yang Dipilih</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Pilih skill dari Taksonomi Standar B7 atau buat skill kustom Anda sendiri untuk dinilai oleh AI.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <Button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="gradient-teal text-white rounded-xl text-xs h-9 px-4 font-semibold"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Pilih dari Taksonomi B7
                </Button>
              </div>
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
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/assessments")}
            className="rounded-xl border-slate-200 h-11 px-5 text-xs font-semibold"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="gradient-teal text-white hover:opacity-95 rounded-xl h-11 px-6 text-xs font-semibold shadow-md shadow-teal-500/20"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menyimpan Asesmen...
              </>
            ) : (
              "Simpan & Buat Sesi Wawancara →"
            )}
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
