import { useEffect, useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import { ArrowLeft, Plus, Loader2, Trash2, Archive } from "lucide-react";
import { toast } from "sonner";
import { assessmentsApi } from "@/services/assessments";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentSkill } from "@/types";
import type { AssessmentFormValues } from "./AssessmentNewPage";

export default function AssessmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasSessions, setHasSessions] = useState(false);

  const form = useForm<AssessmentFormValues>({
    defaultValues: { name: "", time_limit_min: 45, skills: [] },
  });

  const { register, handleSubmit, control, setValue, reset, formState: { errors } } = form;
  const { fields, append, remove, move, update } = useFieldArray({ control, name: "skills", keyName: "_key" });

  const handleRemoveSkill = (index: number) => {
    const skill = fields[index];
    if (skill.id) {
      update(index, { ...skill, _destroy: true });
    } else {
      remove(index);
    }
  };

  useEffect(() => {
    assessmentsApi
      .get(Number(id))
      .then((res) => {
        const a = res.data.assessment;
        reset({ name: a.name, time_limit_min: a.time_limit_min, skills: a.skills });
        setHasSessions(Boolean(a.has_sessions));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, reset]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f._key === active.id);
      const newIndex = fields.findIndex((f) => f._key === over.id);
      move(oldIndex, newIndex);
    }
  };

  const onSubmit = async (data: AssessmentFormValues) => {
    if (data.skills.length === 0) { setError("Add at least one skill."); return; }
    setError(null);
    setSubmitting(true);
    try {
      await assessmentsApi.update(Number(id), {
        name: data.name,
        time_limit_min: data.time_limit_min,
        assessment_skills_attributes: data.skills.map((s, i) => ({ ...s, display_order: i })),
      });
      toast.success("Assessment saved");
      navigate(`/assessments/${id}/invite`);
    } catch (e: any) {
      const message = e?.response?.data?.errors?.[0]?.message ?? "Failed to save.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Assessments with sessions can't be hard-deleted (would destroy candidate
  // interview history) — archive instead, which just hides it from active use.
  const handleDeleteOrArchive = async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      if (hasSessions) {
        await assessmentsApi.archive(Number(id));
        toast.success("Assessment archived");
      } else {
        await assessmentsApi.delete(Number(id));
        toast.success("Assessment deleted");
      }
      navigate("/assessments");
    } catch (e: any) {
      const fallback = hasSessions ? "Failed to archive assessment." : "Failed to delete assessment.";
      const message = e?.response?.data?.errors?.[0]?.message ?? fallback;
      setDeleteError(message);
      toast.error(message);
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

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
      <div className="flex items-center gap-2 mb-6">
        <Link to="/assessments" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-muted-foreground">Back</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium">Edit Assessment</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIME_LIMIT_OPTIONS.map((min) => (
                <SelectItem key={min} value={String(min)}>{min} min</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-3">
          <Label>Skills to assess</Label>
          {fields.filter((f) => !f._destroy).length === 0 ? (
            <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
              No skills added yet.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.filter((f) => !f._destroy).map((f) => f._key)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    field._destroy ? null : (
                      <SkillCard key={field._key} id={field._key} index={index} form={form} onRemove={() => handleRemoveSkill(index)} />
                    )
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add from B7 taxonomy
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ skill_label: "", is_custom: true, expected_level: 3, display_order: fields.length })}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add custom skill
            </Button>
          </div>
        </div>

        <Separator />
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            className={hasSessions ? "" : "text-destructive hover:text-destructive"}
            onClick={() => setConfirmOpen(true)}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : hasSessions ? (
              <Archive className="h-4 w-4 mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            {hasSessions ? "Archive Assessment" : "Delete Assessment"}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(`/assessments/${id}/invite`)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
        {deleteError && <p className="text-sm text-destructive text-right">{deleteError}</p>}
      </form>

      <SkillPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(s) => append({ ...s, display_order: fields.length })} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hasSessions ? "Archive this assessment?" : "Delete this assessment?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {hasSessions
                ? "This assessment has invite links / sessions tied to it, so it can't be deleted outright — that would destroy candidates' interview history. Archiving removes it from your active list; existing sessions, transcripts, and results are kept untouched."
                : "This cannot be undone. No invite links have been created for this assessment yet, so it can be deleted safely."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={hasSessions ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDeleteOrArchive();
              }}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {hasSessions ? "Archive" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
