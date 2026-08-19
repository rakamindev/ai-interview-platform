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
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { ArrowLeft, Plus, Loader2, Info } from "lucide-react";
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
    <div className="max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-500 pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link to="/assessments" className="flex items-center justify-center w-8 h-8 rounded-full bg-muted hover:bg-muted/80 transition-colors">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>
        <span className="text-sm text-muted-foreground">Assessments</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">New Assessment</span>
      </div>

      <Card className="shadow-lg border-primary/10 overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary to-blue-500" />
        <CardHeader className="bg-muted/10 pb-8 border-b">
          <CardTitle className="text-2xl">Buat Assessment Baru</CardTitle>
          <CardDescription>Atur judul, durasi, bahasa, dan keahlian yang ingin Anda uji dalam sesi wawancara ini.</CardDescription>
        </CardHeader>
        
        <CardContent className="pt-8">
          <form id="assessment-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Role title */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-semibold">
                Judul Assessment <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Misal: Senior Frontend Engineer"
                className="h-11"
                {...register("name", { required: "Role title is required" })}
              />
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <Info className="w-3 h-3 mr-1" /> Judul ini akan terlihat oleh kandidat pada halaman undangan.
              </p>
              {errors.name && (
                <p className="text-xs text-destructive animate-in slide-in-from-top-1">{errors.name.message}</p>
              )}
            </div>

            <div className="grid gap-8 sm:grid-cols-2">
              {/* Time limit */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">
                  Batas Waktu (Menit) <span className="text-destructive">*</span>
                </Label>
                <Select
                  defaultValue="45"
                  onValueChange={(v) => setValue("time_limit_min", Number(v))}
                >
                  <SelectTrigger className="w-full h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_LIMIT_OPTIONS.map((min) => (
                      <SelectItem key={min} value={String(min)}>
                        {min} menit
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground flex items-center mt-1">
                  <Info className="w-3 h-3 mr-1" /> Wawancara akan otomatis berakhir setelah batas waktu.
                </p>
              </div>

              {/* Language */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Bahasa Wawancara</Label>
                <Select
                  defaultValue="en"
                  onValueChange={(v) => setValue("language", v as "en" | "id")}
                >
                  <SelectTrigger className="w-full h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="id">Indonesian</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground flex items-center mt-1">
                  <Info className="w-3 h-3 mr-1" /> Bahasa yang akan digunakan AI saat bertanya.
                </p>
              </div>
            </div>

            <Separator />

            {/* Skills section */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Keahlian yang Diuji (Skills to Assess)</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-3 flex items-center">
                  <Info className="w-3 h-3 mr-1" /> AI akan memberikan pertanyaan spesifik berdasarkan keahlian ini.
                </p>
              </div>

              {fields.length === 0 ? (
                <div className="border border-dashed rounded-lg p-8 text-center bg-muted/20">
                  <div className="mx-auto w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Belum ada keahlian ditambahkan</p>
                  <p className="text-xs text-muted-foreground mb-4">Tambahkan minimal satu keahlian untuk melanjutkan.</p>
                  <div className="flex justify-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                      Pilih dari Taksonomi
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
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-dashed"
                    onClick={() => setPickerOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Pilih dari Taksonomi
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-dashed"
                    onClick={addCustomSkill}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Keahlian Kustom
                  </Button>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md animate-in slide-in-from-top-1">
                {error}
              </div>
            )}
          </form>
        </CardContent>

        <CardFooter className="flex flex-col-reverse sm:flex-row justify-end gap-3 border-t bg-muted/20 p-4 sm:p-6">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/assessments")}
            className="w-full sm:w-auto"
          >
            Batal
          </Button>
          <Button type="submit" form="assessment-form" disabled={submitting} className="w-full sm:w-auto min-w-[180px]">
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {submitting ? "Menyimpan..." : "Simpan & Buat Sesi →"}
          </Button>
        </CardFooter>
      </Card>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={addB7Skill}
      />
    </div>
  );
}
