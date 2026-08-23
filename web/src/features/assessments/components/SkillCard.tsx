import { useEffect, useState } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { Button } from "@/shared/ui/button";
import LevelRadio from "@/shared/components/LevelRadio";
import TruncatedText from "@/shared/ui/truncated-text";
import CustomSkillDialog from "./CustomSkillDialog";
import { cn } from "@/shared/lib/utils";
import type { AssessmentFormValues } from "@/features/assessments/pages/AssessmentNewPage";

interface SkillCardProps {
  index: number;
  id: string;
  form: UseFormReturn<AssessmentFormValues>;
  onRemove: () => void;
}

type SkillValues = AssessmentFormValues["skills"][number];

// Shared by both skill types — same L1–L5 anchor fields either way.
function AnchorsToggle({ skill, open, onToggle }: { skill?: SkillValues; open: boolean; onToggle: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {open ? "Hide L1–L5 anchors" : "Show L1–L5 anchors"}
      </button>

      {open && (
        <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 rounded p-2">
          {[1, 2, 3, 4, 5].map((level) => {
            const anchor = skill?.[`l${level}_anchor` as keyof typeof skill] as string;
            return anchor ? (
              <div key={level}>
                <span className="font-medium text-foreground">L{level}</span> {anchor}
              </div>
            ) : null;
          })}
        </div>
      )}
    </>
  );
}

export default function SkillCard({ index, id, form, onRemove }: SkillCardProps) {
  const [anchorsOpen, setAnchorsOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const skill = useWatch({ control: form.control, name: `skills.${index}` });
  const isCustom = skill?.is_custom;
  const skillLabel = skill?.skill_label || "New Skill";

  // A freshly-appended custom skill has no name yet — open its edit dialog
  // right away instead of showing the long form inline in the list.
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  useEffect(() => {
    if (isCustom && !skill?.skill_label) setCustomDialogOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border rounded-lg bg-white",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      {/* Card header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{skillLabel}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {isCustom ? "Custom" : skill?.skill_id ? `SK-${String(skill.skill_id).padStart(3, "0")}` : ""}
            </span>
          </div>
        </div>

        {isCustom && (
          <Button
            type="button"
            variant="warning"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={() => setCustomDialogOpen(true)}
            aria-label="Edit custom skill details"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}

        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-7 w-7 p-0 shrink-0"
          onClick={onRemove}
          aria-label="Remove skill"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Card body */}
      <div className="px-3 pb-3 space-y-3">
        {isCustom ? (
          <div className="space-y-3">
            {skill?.scope_include && (
              <p className="mb-1">
                <TruncatedText
                  text={skill.scope_include}
                  maxLength={100}
                  className="text-xs text-muted-foreground"
                />
              </p>
            )}

            <AnchorsToggle skill={skill} open={anchorsOpen} onToggle={() => setAnchorsOpen((o) => !o)} />

            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Expected level:</span>
              <LevelRadio
                value={skill?.expected_level ?? 3}
                onChange={(v) => form.setValue(`skills.${index}.expected_level`, v)}
              />
            </div>

            <CustomSkillDialog
              open={customDialogOpen}
              onOpenChange={setCustomDialogOpen}
              index={index}
              form={form}
              onDiscardIfBlank={onRemove}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <AnchorsToggle skill={skill} open={anchorsOpen} onToggle={() => setAnchorsOpen((o) => !o)} />

            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Expected level:</span>
              <LevelRadio
                value={skill?.expected_level ?? 3}
                onChange={(v) => form.setValue(`skills.${index}.expected_level`, v)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
