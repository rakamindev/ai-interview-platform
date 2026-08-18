import { useMutation } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";
import { parseLevel, LEVEL_LABELS } from "@/utils/constants";

import { portfolioMutations } from "../mutations/portfolio";
import type { AssessorOverride, PortfolioSkill } from "../schemas/portfolio";
import { LevelBadge } from "./level-badge";

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

export function OverridePanel({ skill, existingOverride, onSaved }: OverridePanelProps) {
  const [open, setOpen] = useState(false);
  const [overrideLevel, setOverrideLevel] = useState<number>(
    existingOverride?.override_level ?? parseLevel(skill.ai_level)
  );
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");

  const hasOverride = !!existingOverride;

  const saveMutation = useMutation({
    ...portfolioMutations.override(skill.id),
    onSuccess: (res) => {
      onSaved(res.override);
      setOpen(false);
    },
    onError: () => {
      toastManager.add({
        type: "error",
        title: "Failed to save override. Please try again.",
      });
    },
  });

  return (
    <div className="flex items-center gap-2">
      {hasOverride && (
        <div className="flex items-center gap-1.5 text-sm">
          <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
          <span className="text-xs text-muted-foreground">AI</span>
          <span className="text-muted-foreground">→</span>
          <LevelBadge level={existingOverride.override_level} size="sm" />
          <span className="text-xs font-medium text-success">You Overridden ✓</span>
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button variant={hasOverride ? "ghost" : "outline"} size="sm" />
          }
        >
          {hasOverride ? (
            <>
              <Pencil className="mr-1 size-3" /> Edit override
            </>
          ) : (
            "Override rating"
          )}
        </PopoverTrigger>

        <PopoverContent className="space-y-3 p-2.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Override
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Your rating:</Label>
            <Select value={String(overrideLevel)} onValueChange={(val) => setOverrideLevel(Number(val))}>
              <SelectTrigger className="w-full!">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <SelectItem key={level} value={String(level)}>
                      {LEVEL_LABELS[level]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`notes-${skill.id}`} className="text-sm">
              Notes (optional):
            </Label>
            <Textarea
              id={`notes-${skill.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add context for your override..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate({ override_level: overrideLevel, assessor_notes: notes })}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Save override
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
