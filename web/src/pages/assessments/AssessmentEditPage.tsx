import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
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
import { Skeleton } from "@/components/ui/skeleton";
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
  CheckCircle2,
  Settings,
} from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentSkill } from "@/types";
import type { AssessmentFormValues } from "./AssessmentNewPage";

export default function AssessmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AssessmentFormValues>({
    defaultValues: { name: "", time_limit_min: 45, language: "en", skills: [] },
  });

  const { register, handleSubmit, control, setValue, reset, formState: { errors } } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "skills" });

  useEffect(() => {
    assessmentsApi
      .get(Number(id))
      .then((res) => {
        const a = res.data.assessment;
        reset({
          name: a.name,
          time_limit_min: a.time_limit_min,
          language: a.language ?? "en",
          skills: a.skills ?? [],
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, reset]);

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

  const onSubmit = async (data: AssessmentFormValues) => {
    if (data.skills.length === 0) {
      setError("Tambahkan minimal 1 kompetensi skill.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await assessmentsApi.update(Number(id), {
        name: data.name,
        time_limit_min: data.time_limit_min,
        language: data.language,
        assessment_skills_attributes: data.skills.map((s, i) => ({ ...s, display_order: i })),
      });
      navigate(`/assessments/${id}/invite`);
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Gagal menyimpan perubahan asesmen.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <Skeleton className="lg:col-span-8 h-96 rounded-3xl" />
          <Skeleton className="lg:col-span-4 h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            to={`/assessments/${id}/invite`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal-700 bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-xs transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Sesi Asesmen
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-medium text-slate-500">Edit Konfigurasi</span>
        </div>

        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-xs py-1">
          <Settings className="h-3 w-3 mr-1 text-slate-600" />
          ID: #{id}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Form Column */}
        <div className="lg:col-span-8">
          <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/40">
              <CardTitle className="text-xl font-bold text-slate-900 tracking-tight">
                Edit Konfigurasi Asesmen
              </CardTitle>
              <p className="text-xs text-slate-500">
                Perbarui parameter penilaian, batas durasi, dan target kompetensi untuk sesi kandidat berikutnya.
              </p>
            </CardHeader>

            <CardContent className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-bold text-slate-700">
                    Judul Posisi / Role Title <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    className="h-11 rounded-xl bg-slate-50/50 border-slate-200 text-sm focus:bg-white"
                    {...register("name", { required: true })}
                  />
                  {errors.name && (
                    <p className="text-xs text-rose-500 font-medium">Judul posisi wajib diisi</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-teal-600" />
                      <span>Alokasi Waktu Sesi</span>
                    </Label>
                    <Select
                      value={String(form.watch("time_limit_min"))}
                      onValueChange={(v) => setValue("time_limit_min", Number(v))}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 border-slate-200 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {TIME_LIMIT_OPTIONS.map((min) => (
                          <SelectItem key={min} value={String(min)}>
                            {min} Menit
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-teal-600" />
                      <span>Bahasa Wawancara AI</span>
                    </Label>
                    <Select
                      value={form.watch("language") ?? "en"}
                      onValueChange={(v) => setValue("language", v as "en" | "id")}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 border-slate-200 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="en">English (Global Standard)</SelectItem>
                        <SelectItem value="id">Bahasa Indonesia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator className="bg-slate-100" />

                {/* Skills list */}
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-800">
                    Target Kompetensi ({fields.length} skill)
                  </Label>

                  {fields.length === 0 ? (
                    <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500 bg-slate-50/50">
                      Belum ada kompetensi terdaftar.
                    </div>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
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

                  <div className="flex flex-wrap items-center gap-2 pt-1">
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
                      onClick={() => append({ skill_label: "", is_custom: true, expected_level: 3, display_order: fields.length })}
                      className="rounded-xl text-slate-600 hover:bg-slate-100 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Tambah Custom Skill
                    </Button>
                  </div>
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-medium text-rose-700">
                    {error}
                  </div>
                )}

                <Separator className="bg-slate-100" />

                <div className="flex items-center justify-end gap-3 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate(`/assessments/${id}/invite`)}
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
                    Simpan Perubahan
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <ShieldCheck className="h-4 w-4 text-teal-600" />
              <span>Integritas Sesi Berjalan</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Perubahan pada target skill hanya akan diterapkan pada sesi kandidat baru yang di-generate setelah penyimpanan. Sesi yang sedang aktif atau sudah selesai tidak akan terpengaruh.
            </p>

            <Separator className="bg-slate-100" />

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 shrink-0 mt-0.5" />
                <span>Rubrik L1–L5 otomatis disinkronisasikan ke AI Evaluator.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 shrink-0 mt-0.5" />
                <span>Format transkrip dan audio tersimpan dalam data warehouse terenkripsi.</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(s) => append({ ...s, display_order: fields.length })}
      />
    </div>
  );
}
