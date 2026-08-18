import { useState } from "react";
import {
  useFieldArray,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { isCustomVacancySkill } from "@/utils/vacancySkills";
import { Plus, X } from "lucide-react";
import type { VacancySkill } from "@/types";

export interface VacancyFormValues {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  skills: Partial<VacancySkill>[];
}

interface VacancySkillsEditorProps {
  control: Control<VacancyFormValues>;
  register: UseFormRegister<VacancyFormValues>;
  setValue: UseFormSetValue<VacancyFormValues>;
  watch: UseFormWatch<VacancyFormValues>;
}

/**
 * Shared expected-skills editor for vacancy new/edit.
 * Taxonomy rows keep a fixed label; custom rows edit name + level only.
 */
export default function VacancySkillsEditor({
  control,
  register,
  setValue,
  watch,
}: VacancySkillsEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  return (
    <div className="space-y-3">
      <Label>Expected skills</Label>

      {fields.length === 0 ? (
        <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground">
          No skills added yet.
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((field, index) => {
            const skill = watch(`skills.${index}`);
            const custom = isCustomVacancySkill(skill ?? {});

            return (
              <div key={field.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {custom ? (
                      <>
                        <Label
                          htmlFor={`skills.${index}.skill_label`}
                          className="text-xs text-muted-foreground"
                        >
                          Custom skill
                        </Label>
                        <Input
                          id={`skills.${index}.skill_label`}
                          placeholder="e.g. Domain ownership"
                          {...register(`skills.${index}.skill_label`, {
                            required: true,
                          })}
                        />
                      </>
                    ) : (
                      <span className="text-sm font-medium">
                        {watch(`skills.${index}.skill_label`)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                    aria-label="Remove skill"
                  >
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
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add from Skill Taxonomy
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ skill_label: "", expected_level: 3 })}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add custom skill
        </Button>
      </div>

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
      />
    </div>
  );
}
