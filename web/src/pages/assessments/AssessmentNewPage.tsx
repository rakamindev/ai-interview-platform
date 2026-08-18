import { useNavigate, Link } from "react-router-dom";
import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import { useAssessmentNewPage } from "@/pages/assessments/useAssessmentNewPage";

export default function AssessmentNewPage() {
  const navigate = useNavigate();
  const { form, fields, sensors, pickerOpen, error, submitting, addB7Skill, addCustomSkill, handleSubmit, remove, handleDragEnd, onSubmit, setPickerOpen, setValue } = useAssessmentNewPage();
  const { errors } = form.formState;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link to="/assessments" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">Back</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">New Assessment</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Role title */}
        <div className="space-y-1.5">
          <Label htmlFor="name">
            Role title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Senior Frontend Engineer"
            maxLength={128}
            error={!!errors.name}
            {...form.register("name")}
          />
          {errors.name && (
            <p className="text-sm font-medium text-destructive">{errors.name.message}</p>
          )}
        </div>

        {/* Time limit */}
        <div className="space-y-1.5">
          <Label>
            Session time limit <span className="text-destructive">*</span>
          </Label>
          <Select
            defaultValue="45"
            onValueChange={(v) => setValue("time_limit_min", Number(v))}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_LIMIT_OPTIONS.map((min) => (
                <SelectItem key={min} value={String(min)}>
                  {min} min
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Language */}
        <div className="space-y-1.5">
          <Label>Interview language</Label>
          <Select
            defaultValue="en"
            onValueChange={(v) => setValue("language", v as "en" | "id")}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="id">Indonesian</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Skills section */}
        <div className="space-y-3">
          <Label>Skills to assess</Label>

          {fields.length === 0 ? (
            <div className={`border rounded-lg p-6 text-center text-sm text-muted-foreground ${errors?.skills ? "border-destructive" : ""}`}>
              <p className={`${errors?.skills ? "text-destructive" : ""}`}>No skills added yet.</p>
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
                <div className="space-y-2">
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

          {errors.skills && (
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
              Add from Skill Taxonomy
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
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/assessments")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save &amp; Create Session →
          </Button>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={addB7Skill}
      />
    </div>
  );
}
