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
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Loader2, Trash2, Clock, Sparkles, Layers, Globe } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentSkill } from "@/types";
import type { AssessmentFormValues } from "./AssessmentNewPage";
import HeroBanner from "@/components/common/HeroBanner";
import RakaminSpinner from "@/components/common/RakaminSpinner";

export default function AssessmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
        reset({ name: a.name, time_limit_min: a.time_limit_min, language: a.language || "en", skills: a.skills });
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
    if (data.skills.length === 0) { setError("Tambahkan minimal 1 skill rubrik kompetensi."); return; }
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
      setError(e?.response?.data?.errors?.[0]?.message ?? "Gagal menyimpan perubahan assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await assessmentsApi.delete(Number(id));
      navigate("/assessments");
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Gagal menghapus assessment. Pastikan tidak ada sesi wawancara aktif.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <RakaminSpinner text="Memuat konfigurasi assessment..." size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Link to="/assessments" className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-xs text-slate-500">Assessments</span>
          <span className="text-xs text-slate-400">/</span>
          <span className="text-xs font-bold text-slate-900">Edit Assessment #{id}</span>
        </div>

        {/* Delete button trigger */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto h-10 sm:h-9 rounded-xl text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/60 justify-center"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Hapus Assessment
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg font-bold text-slate-900">
                Konfirmasi Hapus Assessment?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-slate-600">
                Tindakan ini akan menghapus assessment ini secara permanen dari sistem. Sesi kandidat yang terhubung tidak akan dapat diakses kembali.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl text-xs">Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90 text-white rounded-xl text-xs font-bold"
              >
                Ya, Hapus Permanen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Hero Banner with Rakamin program photo */}
      <HeroBanner
        badgeText="⭐️ Assessment & Rubric Editor"
        title="Edit Technical Assessment"
        highlightText="Rubrik B7"
        subtitle="Sesuaikan judul role, batas durasi sesi, dan susunan rubrik kompetensi terstandarisasi."
        bulletPoints={[
          "Penetapan kriteria anchor kompetensi terstruktur (L1 s/d L5)",
          "Reorganisasi urutan prioritas probing wawancara AI",
          "Sinkronisasi langsung ke pembuatan token undangan kandidat",
        ]}
        imageSrc="/images/program.png"
        imageAlt="Rakamin Edit Assessment"
        imageFloatingBadge={{
          title: "B7 Rubric Matrix",
          subtitle: "Standardized Anchors",
        }}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Card 1: Basic Config */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sparkles className="h-4 w-4 text-[#01959f]" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
              Konfigurasi Utama Sesi Assessment
            </h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Judul Role / Posisi <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Contoh: Senior Frontend Engineer"
              className="h-12 text-sm sm:text-base font-semibold rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
              {...register("name", { required: true })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-2">
              <Label className="h-5 flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Batas Waktu Sesi (Menit) <span className="text-destructive">*</span></span>
              </Label>
              <Select
                value={String(form.watch("time_limit_min"))}
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
                value={form.watch("language") || "en"}
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

        {/* Card 2: Skill Rubrics */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#01959f]" />
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Rubrik Kompetensi Standar B7
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-semibold bg-teal-50 text-[#01808a] px-2.5 py-0.5 rounded-full border border-teal-100">
              {fields.length} Rubrik Terdaftar
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Urutkan prioritas rubrik dengan menarik handle di sebelah kiri. AI interviewer akan mengeksplorasi kompetensi dari atas ke bawah.
          </p>

          {fields.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2 bg-slate-50/50">
              <p className="text-sm font-semibold text-slate-700">Belum ada rubrik kompetensi</p>
              <p className="text-xs text-slate-500">Tambahkan minimal 1 skill dari taksonomi B7 atau kustom.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <SkillCard key={field.id} id={field.id} index={index} form={form} onRemove={() => remove(index)} />
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
              <Plus className="h-4 w-4 mr-1.5" /> Tambah dari Taksonomi B7
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => append({ skill_label: "", is_custom: true, expected_level: 3, display_order: fields.length })}
              className="w-full sm:w-auto flex-1 rounded-xl text-xs sm:text-sm font-semibold h-11 min-h-[44px] px-4 border-slate-200 hover:bg-slate-50 justify-center shadow-2xs"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Tambah Skill Kustom
            </Button>
          </div>
        </div>

        {error && (
          <div className="border border-destructive/30 rounded-xl p-4 bg-destructive/5 text-sm text-destructive font-medium">
            {error}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-center sm:justify-end gap-3 pt-3 w-full">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl h-11 px-6 font-semibold"
            onClick={() => navigate(`/assessments/${id}/invite`)}
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
            Simpan Perubahan
          </Button>
        </div>
      </form>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(s) => append({ ...s, display_order: fields.length })} />
    </div>
  );
}
