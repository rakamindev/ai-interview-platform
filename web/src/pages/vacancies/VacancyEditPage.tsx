import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { vacanciesApi } from "@/services/vacancies";
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { VacancySkill, WorkArrangement, EmploymentType } from "@/types";

interface VacancyFormValues {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  address: string;
  city: string;
  work_arrangement: WorkArrangement | "";
  employment_type: EmploymentType | "";
  department: string;
  salary_min: string;
  salary_max: string;
  salary_visible: boolean;
  description: string;
  application_deadline: string;
  skills: Partial<VacancySkill>[];
}

const WORK_ARRANGEMENTS: { value: WorkArrangement; label: string }[] = [
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
];

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

export default function VacancyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { register, handleSubmit, control, setValue, watch, reset } = useForm<VacancyFormValues>({
    defaultValues: {
      role_title: "", culture_dimensions: "", competency_expectations: "",
      address: "", city: "", work_arrangement: "", employment_type: "", department: "",
      salary_min: "", salary_max: "", salary_visible: false,
      description: "", application_deadline: "", skills: [],
    },
  });
  const { fields, append, remove, update } = useFieldArray({ control, name: "skills", keyName: "_key" });

  const handleRemoveSkill = (index: number) => {
    const skill = fields[index];
    if (skill.id) {
      update(index, { ...skill, _destroy: true });
    } else {
      remove(index);
    }
  };

  useEffect(() => {
    vacanciesApi.get(Number(id)).then((res) => {
      const v = res.data.vacancy;
      reset({
        role_title: v.role_title,
        culture_dimensions: v.culture_dimensions,
        competency_expectations: v.competency_expectations,
        address: v.address ?? "",
        city: v.city ?? "",
        work_arrangement: v.work_arrangement ?? "",
        employment_type: v.employment_type ?? "",
        department: v.department ?? "",
        salary_min: v.salary_min?.toString() ?? "",
        salary_max: v.salary_max?.toString() ?? "",
        salary_visible: v.salary_visible ?? false,
        description: v.description ?? "",
        application_deadline: v.application_deadline ?? "",
        skills: v.skills,
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: VacancyFormValues) => {
    setSubmitting(true);
    try {
      await vacanciesApi.update(Number(id), {
        role_title: data.role_title,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        address: data.address || undefined,
        city: data.city || undefined,
        work_arrangement: data.work_arrangement || undefined,
        employment_type: data.employment_type || undefined,
        department: data.department || undefined,
        salary_min: data.salary_min ? Number(data.salary_min) : null,
        salary_max: data.salary_max ? Number(data.salary_max) : null,
        salary_visible: data.salary_visible,
        description: data.description || undefined,
        application_deadline: data.application_deadline || undefined,
        vacancy_skills_attributes: data.skills,
      });
      toast.success("Vacancy saved");
      navigate("/vacancies");
    } catch (e: any) {
      toast.error(e?.response?.data?.errors?.[0]?.message ?? "Failed to save vacancy.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-10 w-full" /></div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/vacancies" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
        <span className="text-sm font-medium">Edit Vacancy</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1.5">
          <Label>Role title <span className="text-destructive">*</span></Label>
          <Input {...register("role_title", { required: true })} />
        </div>
        <Separator />
        <div className="space-y-3">
          <Label>Expected skills</Label>
          {fields.map((field, index) => (
            field._destroy ? null : (
              <div key={field._key} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{watch(`skills.${index}.skill_label`)}</span>
                  <button type="button" onClick={() => handleRemoveSkill(index)} className="text-muted-foreground hover:text-destructive" aria-label="Remove skill"><X className="h-4 w-4" /></button>
                </div>
                <LevelRadio value={watch(`skills.${index}.expected_level`) ?? 3} onChange={(v) => setValue(`skills.${index}.expected_level`, v)} />
              </div>
            )
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add skill
          </Button>
        </div>

        <Separator />

        {/* Location */}
        <div className="space-y-3">
          <Label>Location</Label>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="City" {...register("city")} />
            <Select value={watch("work_arrangement")} onValueChange={(v) => setValue("work_arrangement", v as WorkArrangement)}>
              <SelectTrigger><SelectValue placeholder="Work arrangement" /></SelectTrigger>
              <SelectContent>
                {WORK_ARRANGEMENTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Textarea placeholder="Full address" rows={2} {...register("address")} />
        </div>

        <Separator />

        {/* Employment */}
        <div className="space-y-3">
          <Label>Employment</Label>
          <div className="grid grid-cols-2 gap-3">
            <Select value={watch("employment_type")} onValueChange={(v) => setValue("employment_type", v as EmploymentType)}>
              <SelectTrigger><SelectValue placeholder="Employment type" /></SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Department" {...register("department")} />
          </div>
        </div>

        <Separator />

        {/* Compensation */}
        <div className="space-y-3">
          <Label>Compensation</Label>
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" placeholder="Min salary" {...register("salary_min")} />
            <Input type="number" placeholder="Max salary" {...register("salary_max")} />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={watch("salary_visible")}
              onCheckedChange={(v) => setValue("salary_visible", v)}
            />
            Show salary range on the candidate-facing view
          </label>
        </div>

        <Separator />

        {/* Description & deadline */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Job description</Label>
            <Textarea rows={4} placeholder="Responsibilities, requirements, benefits..." {...register("description")} />
          </div>
          <div className="space-y-1.5">
            <Label>Application deadline</Label>
            <Input type="date" {...register("application_deadline")} />
          </div>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label>Company culture</Label>
          <Textarea rows={3} {...register("culture_dimensions")} />
        </div>
        <div className="space-y-1.5">
          <Label>Competency expectations</Label>
          <Textarea rows={3} {...register("competency_expectations")} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/vacancies")}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes</Button>
        </div>
      </form>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(s) => append({ skill_id: s.skill_id, skill_label: s.skill_label, expected_level: 3 })} />
    </div>
  );
}
