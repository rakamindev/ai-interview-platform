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
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Sparkles,
  Clock,
  Globe,
  ShieldCheck,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
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
      setError("Tambahkan minimal 1 kompetensi skill untuk dievaluasi oleh AI.");
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
      setError(e?.response?.data?.errors?.[0]?.message ?? "Gagal menyimpan konfigurasi asesmen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            to="/assessments"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal-700 bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-xs transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Daftar Asesmen
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-medium text-slate-500">Buat Asesmen Baru</span>
        </div>

        <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-xs py-1">
          <Sparkles className="h-3 w-3 mr-1 text-teal-600" />
          Gemini 2026 Engine
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Column */}
        <div className="lg:col-span-8">
          <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/40">
              <CardTitle className="text-xl font-bold text-slate-900 tracking-tight">
                Parameter &amp; Target Kompetensi
              </CardTitle>
              <p className="text-xs text-slate-500">
                Tentukan judul role, alokasi waktu wawancara, bahasa, dan daftar kompetensi yang akan digali oleh AI Interviewer.
              </p>
            </CardHeader>

            <CardContent className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Role title */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Judul Posisi / Role Title <span className="text-rose-500">*</span></span>
                    <span className="text-[11px] font-normal text-slate-400">Contoh: Senior Backend Engineer (Ruby &amp; Go)</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="Masukkan nama posisi..."
                    className="h-11 rounded-xl bg-slate-50/50 border-slate-200 text-sm focus:bg-white focus:border-teal-500"
                    {...register("name", { required: "Role title wajib diisi" })}
                  />
                  {errors.name && (
                    <p className="text-xs text-rose-500 font-medium">{errors.name.message}</p>
                  )}
                </div>

                {/* Session Configuration Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Time limit */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-teal-600" />
                      <span>Alokasi Waktu Sesi</span>
                    </Label>
                    <Select
                      defaultValue="45"
                      onValueChange={(v) => setValue("time_limit_min", Number(v))}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 border-slate-200 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {TIME_LIMIT_OPTIONS.map((min) => (
                          <SelectItem key={min} value={String(min)}>
                            {min} Menit (Rekomendasi {Math.floor(min / 10)} skill)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Language */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-teal-600" />
                      <span>Bahasa Wawancara AI</span>
                    </Label>
                    <Select
                      defaultValue="en"
                      onValueChange={(v) => setValue("language", v as "en" | "id")}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 border-slate-200 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="en">English (Global Standard)</SelectItem>
                        <SelectItem value="id">Bahasa Indonesia (Natural Dialog)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator className="bg-slate-100" />

                {/* Skills section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-bold text-slate-800">
                        Target Kompetensi ({fields.length} skill ditentukan)
                      </Label>
                      <p className="text-[11px] text-slate-500">
                        Urutkan prioritas probing dengan menarik handle di sebelah kiri skill card.
                      </p>
                    </div>
                  </div>

                  {fields.length === 0 ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50 space-y-3">
                      <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Belum ada kompetensi ditambahkan</p>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                          Tambahkan skill dari perpustakaan standar B7 Taxonomy atau buat custom skill sesuai kebutuhan spesifik tim Anda.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPickerOpen(true)}
                          className="rounded-xl border-teal-200 text-teal-800 hover:bg-teal-50 font-semibold text-xs"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1 text-teal-600" />
                          Pilih dari B7 Taxonomy
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={addCustomSkill}
                          className="rounded-xl text-slate-600 hover:bg-slate-100 text-xs"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Buat Custom Skill
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

                  {fields.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPickerOpen(true)}
                        className="rounded-xl border-teal-200 text-teal-800 hover:bg-teal-50 font-semibold text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1 text-teal-600" />
                        Pilih dari B7 Taxonomy
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addCustomSkill}
                        className="rounded-xl text-slate-600 hover:bg-slate-100 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Tambah Custom Skill
                      </Button>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-medium text-rose-700">
                    {error}
                  </div>
                )}

                <Separator className="bg-slate-100" />

                {/* Form Action Controls */}
                <div className="flex items-center justify-end gap-3 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate("/assessments")}
                    className="rounded-xl text-xs font-semibold text-slate-600"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs h-10 px-5 shadow-sm"
                  >
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Simpan &amp; Lanjut ke Invite Link →
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Information Column */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white p-5 space-y-4">
            <div className="flex items-center gap-2 text-teal-700 font-bold text-sm">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span>Praktik Terbaik Asesmen</span>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-800">3–5 Target Kompetensi:</strong> Ideal untuk sesi 45 menit agar AI Interviewer dapat menggali teknik STAR dan bukti nyata secara mendalam.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-800">Rubrik Level L1–L5:</strong> Mengurangi bias subjektivitas pewawancara manual dengan mengacu pada standar kompetensi terstruktur.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-800">Dynamic Probing:</strong> AI secara adaptif memberikan pertanyaan lanjutan jika jawaban kandidat terindikasi belum mencukupi.
                </p>
              </div>
            </div>

            <Separator className="bg-slate-100" />

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                <ShieldCheck className="h-4 w-4 text-teal-600" />
                <span>Kepatuhan UU PDP &amp; AI Safety</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Platform beroperasi di bawah kepatuhan UU PDP No. 27/2022. Semua transkrip suara diproses dalam tenant terisolasi dan tidak digunakan untuk melatih model publik.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={addB7Skill}
      />
    </div>
  );
}
