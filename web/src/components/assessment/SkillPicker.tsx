import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import type { AssessmentSkill } from "@/types";
import { useSkillPicker } from "@/components/assessment/useSkillPicker";
import { Button } from "@/components/ui/button";

export interface SkillPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (skill: Partial<AssessmentSkill>) => void;
}

export default React.memo(function SkillPicker({ open, onOpenChange, onSelect }: SkillPickerProps) {
  const { loading, query, filtered, error, handleSelect, setQuery, getSkills } = useSkillPicker({ open, onOpenChange, onSelect });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add from B7 taxonomy</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus
            disabled={loading || error}
          />
        </div>

        <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center pt-3 pb-6 text-center">
              <p className="mt-1 text-sm text-destructive">
                We couldn't retrieve the skill taxonomy. Please try again.
              </p>

              <Button className="mt-3" variant="destructiveOutline" onClick={getSkills}>
                Try Again
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No skills found.</p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.skill_id}
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm"
              >
                {s.skill_label}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
})
