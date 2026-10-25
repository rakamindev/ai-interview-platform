import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { extractApiError } from "@/lib/apiErrors";
import { cn } from "@/lib/utils";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { ArrowLeft, Plus, Loader2, RefreshCw } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentSkill } from "@/types";
import type { AssessmentFormValues } from "./AssessmentNewPage";
import { assessmentKeys } from "@/lib/queryKeys";

export default function AssessmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const assessmentId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  const form = useForm<AssessmentFormValues>({
    defaultValues: { name: "", time_limit_min: 45, skills: [] },
  });

  const { register, handleSubmit, control, setValue, reset, formState: { errors } } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "skills" });

  const assessmentQuery = useQuery({
    queryKey: assessmentKeys.detail(assessmentId),
    queryFn: async () => (await assessmentsApi.get(assessmentId)).data.assessment,
  });

  const updateMutation = useMutation({
    mutationFn: (data: AssessmentFormValues) =>
      assessmentsApi.update(assessmentId, {
        name: data.name,
        time_limit_min: data.time_limit_min,
        language: data.language,
        assessment_skills_attributes: data.skills.map((skill, index) => ({
          ...skill,
          display_order: index,
        })),
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(assessmentKeys.detail(assessmentId), response.data.assessment);
      void queryClient.invalidateQueries({ queryKey: assessmentKeys.lists() });
    },
  });

  useEffect(() => {
    const assessment = assessmentQuery.data;
    if (!assessment) return;

    reset({
      name: assessment.name,
      time_limit_min: assessment.time_limit_min,
      language: assessment.language ?? "en",
      skills: assessment.skills,
    });
    setSkillsError(null);
  }, [assessmentQuery.data, reset]);

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
    if (data.skills.length === 0) {
      setSkillsError("Add at least one skill before saving the assessment.");
      return;
    }
    setSkillsError(null);
    setError(null);
    try {
      await updateMutation.mutateAsync(data);
      navigate(`/assessments/${id}/invite`);
    } catch (e) {
      setError(extractApiError(e).message);
    }
  };

  const onInvalidSubmit = () => {
    if (fields.length === 0) {
      setSkillsError("Add at least one skill before saving the assessment.");
    }
  };

  if (assessmentQuery.isPending) {
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
      <div className="flex items-center gap-2 mb-6">
        <Link to="/assessments" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">Back</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">Edit Assessment</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalidSubmit)} className="space-y-6">
        {assessmentQuery.isError && (
          <Alert>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">Couldn't load this assessment: {extractApiError(assessmentQuery.error).message}</p>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void assessmentQuery.refetch()}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          </Alert>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="name">Role title <span className="text-destructive">*</span></Label>
          <Input id="name" {...register("name", { required: true })} />
        </div>

        <div className="space-y-1.5">
          <Label>Session time limit <span className="text-destructive">*</span></Label>
          <Select
            value={String(form.watch("time_limit_min"))}
            onValueChange={(v) => setValue("time_limit_min", Number(v))}
          >
            <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIME_LIMIT_OPTIONS.map((min) => (
                <SelectItem key={min} value={String(min)}>{min} min</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div
          className="space-y-3"
          role="group"
          aria-labelledby="skills-label"
          aria-describedby={skillsError ? "skills-error" : undefined}
          aria-invalid={skillsError ? true : undefined}
        >
          <Label id="skills-label">
            Skills to assess <span className="text-destructive">*</span>
          </Label>
          {fields.length === 0 ? (
            <div
              className={cn(
                "rounded-lg border p-6 text-center text-sm text-muted-foreground transition-colors",
                skillsError && "border-destructive bg-destructive/5"
              )}
            >
              <p className="mb-1">No skills added yet.</p>
              <p>Choose a skill from the taxonomy or add a custom skill.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <SkillCard key={field.id} id={field.id} index={index} form={form} onRemove={() => remove(index)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <div className="flex flex-row gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add from B7 taxonomy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSkillsError(null);
                append({ skill_label: "", is_custom: true, expected_level: 3, display_order: fields.length });
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add custom skill
            </Button>
          </div>

          {skillsError && (
            <Alert id="skills-error" className="py-2.5">
              <p>{skillsError}</p>
            </Alert>
          )}
        </div>

        <Separator />
        {error && (
          <Alert>
            <p className="text-sm">{error}</p>
          </Alert>
        )}

        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(`/assessments/${id}/invite`)}>Cancel</Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(skill) => {
          setSkillsError(null);
          append({ ...skill, display_order: fields.length });
        }}
      />
    </div>
  );
}
