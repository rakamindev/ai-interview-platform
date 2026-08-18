import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react";
import { useVacancyNewPage } from "./useVacancyNewPage";
import { useVacancyEditPage } from "./useVacancyEditPage";

export default function VacancyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    form,
    fields,
    pickerOpen,
    remove,
    addB7Skill,
    setPickerOpen,
    handleSubmit,
    setValue,
    watch,
    setError,
  } = useVacancyNewPage();
  const { errors } = form.formState;
  const { loading, fetchError, submitting, onSubmit, refetchData, setDeletedSkills } = useVacancyEditPage({ id, form, setError });

  if (loading) return <div className="max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-10 w-full" /></div>;

  return (
    <div className="max-w-2xl mx-auto">
      {fetchError ? (
        <div className="flex flex-col items-center justify-center pt-3 pb-6 min-h-[40vh] text-center">
          <p className="mt-1 text-sm text-destructive">
            We couldn't retrieve the page. Please try again.
          </p>
          <Button className="mt-3" variant="destructiveOutline" onClick={refetchData}>
            Try Again
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-6">
            <Link to="/vacancies" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
            <span className="text-sm font-medium">Edit Vacancy</span>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-1.5">
              <Label htmlFor="role_title">Role title <span className="text-destructive">*</span></Label>
              <Input
                id="role_title"
                error={!!errors.role_title}
                {...form.register("role_title")}
              />
              {errors.role_title && (
                <p className="text-sm font-medium text-destructive">{errors.role_title.message}</p>
              )}
            </div>
            <Separator />
            <div className="space-y-3">
              <Label>Expected skills</Label>
              {fields.length === 0 ? (
                <div className={`border rounded-lg p-6 text-center text-sm text-muted-foreground ${errors?.skills ? "border-destructive" : ""}`}>
                  <p className={`${errors?.skills ? "text-destructive" : ""} mb-2`}>No skills added yet.</p>
                  <p className={`${errors?.skills ? "text-destructive" : ""}`}>Add at least one skill to continue.</p>
                </div>
              ) : (
                <div className="space-y-2">

                  {fields.map((field, index) => (
                    <div key={field.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{watch(`skills.${index}.skill_label`)}</span>
                        <button type="button" onClick={() => {
                          setDeletedSkills((values) => [...values, { ...field, _destroy: true }])
                          remove(index)
                        }} className="text-muted-foreground hover:text-destructive">
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

            <div className="space-y-1.5">
              <Label htmlFor="culture_dimensions">Company culture (used in AI narrative)</Label>
              <Textarea
                id="culture_dimensions"
                placeholder="Ownership-driven, async-first, direct feedback culture..."
                rows={3}
                {...form.register("culture_dimensions")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="competency_expectations">Competency expectations (used in AI narrative)</Label>
              <Textarea
                id="competency_expectations"
                placeholder="Strong communicator who can align cross-functional teams..."
                rows={3}
                {...form.register("competency_expectations")}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate("/vacancies")}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes</Button>
            </div>
          </form>

          <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={addB7Skill} />
        </>
      )}
    </div>
  );
}
