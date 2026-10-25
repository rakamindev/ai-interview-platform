import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Combobox } from "@/components/ui/combobox";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, X, Loader2 } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import type { VacancySkill } from "@/types";

interface VacancyFormValues {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  skills: Partial<VacancySkill>[];
}

export default function VacancyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleTitleOptions, setRoleTitleOptions] = useState<
    { label: string; value: string }[]
  >([]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
  } = useForm<VacancyFormValues>({
    defaultValues: {
      role_title: "",
      culture_dimensions: "",
      competency_expectations: "",
      skills: [],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "skills",
  });

  useEffect(() => {
    vacanciesApi
      .roleTitles()
      .then((res) => {
        const titles = (res.data.role_titles ?? []).map((t) => ({
          label: t,
          value: t,
        }));
        setRoleTitleOptions(titles);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    vacanciesApi
      .get(Number(id))
      .then((res) => {
        const v = res.data.vacancy;
        reset({
          role_title: v.role_title,
          culture_dimensions: v.culture_dimensions,
          competency_expectations: v.competency_expectations,
          skills: v.skills,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: VacancyFormValues) => {
    setError(null);
    setSubmitting(true);
    try {
      await vacanciesApi.update(Number(id), {
        role_title: data.role_title,
        culture_dimensions: data.culture_dimensions,
        competency_expectations: data.competency_expectations,
        vacancy_skills_attributes: data.skills,
      });
      navigate("/vacancies");
    } catch (e: any) {
      setError(
        e?.response?.data?.errors?.[0]?.message ??
          "Failed to save vacancy."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[680px] mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-[680px] mx-auto">
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: "Vacancies", href: "/vacancies" },
            { label: "Edit" },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="bg-white border border-gray-200 rounded-xl p-7">
          {/* Section: Role */}
          <div className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Role details
          </div>

          <div className="mb-5">
            <Label className="mb-1.5">
              Role title <span className="text-destructive">*</span>
            </Label>
            <Combobox
              options={roleTitleOptions}
              value={watch("role_title")}
              onChange={(val) =>
                setValue("role_title", val, { shouldValidate: true })
              }
              placeholder="Select or type a role title..."
            />
            <input
              type="hidden"
              {...register("role_title", { required: true })}
            />
          </div>

          <hr className="border-gray-200 my-6" />

          {/* Section: Skills */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-900">
              Expected skills
            </span>
            <span className="text-xs text-gray-500">
              At least 1 required
            </span>
          </div>

          {fields.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-lg py-7 px-5 text-center mb-4">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-2.5">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-7 h-7 text-gray-400"
                >
                  <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
                </svg>
              </div>
              <p className="text-[13px] text-gray-500">
                No skills added yet.
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Add at least one to continue.
              </p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900">
                      {watch(`skills.${index}.skill_label`)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <LevelRadio
                      value={
                        watch(`skills.${index}.expected_level`) ?? 3
                      }
                      onChange={(v) =>
                        setValue(
                          `skills.${index}.expected_level`,
                          v
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add skill
          </Button>

          <hr className="border-gray-200 my-6" />

          {/* Section: Details */}
          <div className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Additional details
          </div>

          <div className="mb-5">
            <Label className="mb-1.5">Company culture</Label>
            <Textarea
              rows={3}
              placeholder="Ownership-driven, async-first, direct feedback culture..."
              {...register("culture_dimensions")}
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Used in AI narrative generation.
            </p>
          </div>

          <div className="mb-5">
            <Label className="mb-1.5">Competency expectations</Label>
            <Textarea
              rows={3}
              placeholder="Strong communicator who can align cross-functional teams..."
              {...register("competency_expectations")}
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Used in AI narrative generation.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive mt-4">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2.5 pt-5 mt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/vacancies")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(s) =>
          append({
            skill_id: s.skill_id,
            skill_label: s.skill_label,
            expected_level: 3,
          })
        }
        selectedSkillIds={fields
          .filter((f) => f.skill_id)
          .map((f) => f.skill_id!)}
        selectedSkillLabels={fields
          .filter((f) => !f.skill_id && f.skill_label)
          .map((f) => f.skill_label!)}
      />
    </div>
  );
}
