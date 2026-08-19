import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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

export default function VacancyNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = useForm<VacancyFormValues>({
    defaultValues: {
      role_title: "", culture_dimensions: "", competency_expectations: "",
      address: "", city: "", work_arrangement: "", employment_type: "", department: "",
      salary_min: "", salary_max: "", salary_visible: false,
      description: "", application_deadline: "", skills: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "skills", keyName: "_key" });

  const onSubmit = async (data: VacancyFormValues) => {
    setError(null);
    setSubmitting(true);
    try {
      await vacanciesApi.create({
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
      toast.success("Vacancy created");
      navigate("/vacancies");
    } catch (e: any) {
      const message = e?.response?.data?.errors?.[0]?.message ?? "Failed to save vacancy.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/vacancies" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">Vacancies</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">New Vacancy</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="role_title">Role title <span className="text-destructive">*</span></Label>
          <Input id="role_title" placeholder="Senior Frontend Engineer" {...register("role_title", { required: true })} />
        </div>

        <Separator />

        {/* Expected skills */}
        <div className="space-y-3">
          <Label>Expected skills</Label>

          {fields.length === 0 ? (
            <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground">
              No skills added yet.
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field._key} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{watch(`skills.${index}.skill_label`)}</span>
                    <button type="button" onClick={() => remove(index)} className="text-muted-foreground hover:text-destructive" aria-label="Remove skill">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Expected level:</span>
                    <LevelRadio
                      value={watch(`skills.${index}.expected_level`) ?? 3}
                      onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add skill expectation
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
            <Label htmlFor="description">Job description</Label>
            <Textarea id="description" rows={4} placeholder="Responsibilities, requirements, benefits..." {...register("description")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="application_deadline">Application deadline</Label>
            <Input id="application_deadline" type="date" {...register("application_deadline")} />
          </div>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label htmlFor="culture_dimensions">Company culture (used in AI narrative)</Label>
          <Textarea
            id="culture_dimensions"
            placeholder="Ownership-driven, async-first, direct feedback culture..."
            rows={3}
            {...register("culture_dimensions")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="competency_expectations">Competency expectations (used in AI narrative)</Label>
          <Textarea
            id="competency_expectations"
            placeholder="Strong communicator who can align cross-functional teams..."
            rows={3}
            {...register("competency_expectations")}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/vacancies")}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Vacancy
          </Button>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(s) => append({ skill_id: s.skill_id, skill_label: s.skill_label, expected_level: 3 })}
      />
    </div>
  );
}
