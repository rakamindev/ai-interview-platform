import { useParams, useNavigate, Link } from "react-router-dom";
import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import { useAssessmentNewPage } from "@/pages/assessments/useAssessmentNewPage";
import { useAssessmentEditPage } from "@/pages/assessments/useAssessmentEditPage";

export default function AssessmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    form,
    fields,
    sensors,
    pickerOpen,
    error,
    addB7Skill,
    setError,
    addCustomSkill,
    handleSubmit,
    remove,
    handleDragEnd,
    setPickerOpen,
    setValue,
  } = useAssessmentNewPage();

  const {
    loading,
    submitting,
    fetchError,
    refetchData,
    onSubmit,
    setDeletedSkills,
  } = useAssessmentEditPage({
    id,
    form,
    setError,
  });

  const { errors } = form.formState;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

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
            <Link
              to="/assessments"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <span className="text-sm text-muted-foreground">
              Back
            </span>

            <span className="text-sm text-muted-foreground">
              /
            </span>

            <span className="text-sm font-medium">
              Edit Assessment
            </span>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6"
          >
            {/* Role title */}
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Role title{" "}
                <span className="text-destructive">*</span>
              </Label>

              <Input
                id="name"
                maxLength={128}
                error={!!errors.name}
                {...form.register("name")}
              />

              {errors.name && (
                <p className="text-sm font-medium text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Time limit */}
            <div className="space-y-1.5">
              <Label>
                Session time limit{" "}
                <span className="text-destructive">*</span>
              </Label>

              <Select
                value={String(form.watch("time_limit_min"))}
                onValueChange={(value) =>
                  setValue(
                    "time_limit_min",
                    Number(value),
                    { shouldValidate: true }
                  )
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {TIME_LIMIT_OPTIONS.map((min) => (
                    <SelectItem
                      key={min}
                      value={String(min)}
                    >
                      {min} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Skills */}
            <div className="space-y-3">
              <Label>
                Skills to assess
              </Label>

              {fields.length === 0 ? (
                <div
                  className={`border rounded-lg p-6 text-center text-sm text-muted-foreground ${errors.skills
                    ? "border-destructive"
                    : ""
                    }`}
                >
                  <p
                    className={
                      errors.skills
                        ? "text-destructive"
                        : ""
                    }
                  >
                    No skills added yet.
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={fields.map((field) => field.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {fields.map((field, index) => (
                        <SkillCard
                          key={field.id}
                          id={field.id}
                          index={index}
                          form={form}
                          onRemove={() => {
                            setDeletedSkills((values) => [...values, { ...field, _destroy: true }])
                            remove(index)
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {errors.skills?.message && (
                <p className="text-sm font-medium text-destructive mt-2">
                  {errors.skills.message}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add from B7 taxonomy
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCustomSkill}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add custom skill
                </Button>
              </div>
            </div>

            <Separator />

            {error && (
              <p className="text-sm text-destructive">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  navigate(
                    `/assessments/${id}/invite`
                  )
                }
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={submitting}
              >
                {submitting && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </form>

          <SkillPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onSelect={addB7Skill}
          />
        </>
      )}
    </div>
  );
}