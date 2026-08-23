import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import LevelRadio from "@/components/assessment/LevelRadio";
import { assessmentsApi } from "@/services/assessments";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import { Loader2, Sparkles } from "lucide-react";
import type { Vacancy, Assessment } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vacancy: Vacancy;
  onCreated: (assessment: Assessment) => void;
}

interface FormValues {
  name: string;
  time_limit_min: number;
  language: "en" | "id";
  skills: { skill_label: string; expected_level: number; l1_anchor?: string; l2_anchor?: string; l3_anchor?: string; l4_anchor?: string; l5_anchor?: string }[];
}

export default function CreateAssessmentFromVacancyDialog({ open, onOpenChange, vacancy, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch, control, reset } = useForm<FormValues>({
    defaultValues: {
      name: vacancy.role_title,
      time_limit_min: 45,
      language: "en",
      // Pre-populate from vacancy skills — anchors already included in vacancy API response
      skills: (vacancy.skills ?? []).map((s) => ({
        skill_label: s.skill_label,
        expected_level: s.expected_level,
        l1_anchor: (s as any).l1_anchor ?? "",
        l2_anchor: (s as any).l2_anchor ?? "",
        l3_anchor: (s as any).l3_anchor ?? "",
        l4_anchor: (s as any).l4_anchor ?? "",
        l5_anchor: (s as any).l5_anchor ?? "",
      })),
    },
  });

  const { fields } = useFieldArray({ control, name: "skills" });

  const onSubmit = async (data: FormValues) => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await assessmentsApi.create({
        name: data.name,
        time_limit_min: data.time_limit_min,
        language: data.language,
        vacancy_id: vacancy.id,
        assessment_skills_attributes: data.skills.map((s, i) => ({
          skill_label: s.skill_label,
          is_custom: false,
          expected_level: s.expected_level,
          display_order: i,
          l1_anchor: s.l1_anchor ?? "",
          l2_anchor: s.l2_anchor ?? "",
          l3_anchor: s.l3_anchor ?? "",
          l4_anchor: s.l4_anchor ?? "",
          l5_anchor: s.l5_anchor ?? "",
        })),
      });
      onCreated(res.data.assessment);
      onOpenChange(false);
      reset();
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to create assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Assessment</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-xs">
            <Sparkles className="h-3 w-3 text-primary" />
            Pre-filled from <span className="font-medium">{vacancy.role_title}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="assess-name">Assessment name <span className="text-destructive">*</span></Label>
            <Input id="assess-name" {...register("name", { required: true })} />
          </div>

          <div className="flex gap-3">
            <div className="space-y-1.5 flex-1">
              <Label>Time limit</Label>
              <Select
                defaultValue="45"
                onValueChange={(v) => setValue("time_limit_min", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_LIMIT_OPTIONS.map((min) => (
                    <SelectItem key={min} value={String(min)}>{min} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1">
              <Label>Language</Label>
              <Select defaultValue="en" onValueChange={(v) => setValue("language", v as "en" | "id")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="id">Indonesian</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {fields.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Skills ({fields.length} from vacancy)</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {fields.map((field, index) => (
                    <div key={field.id} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                      <p className="text-sm font-medium">{watch(`skills.${index}.skill_label`)}</p>
                      <LevelRadio
                        value={watch(`skills.${index}.expected_level`) ?? 3}
                        onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Assessment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
