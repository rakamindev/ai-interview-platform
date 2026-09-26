import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import LevelRadio from "./LevelRadio";
import type { AssessmentSkill } from "@/types";

interface CustomSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (skill: Partial<AssessmentSkill>) => void;
  initialSkill?: Partial<AssessmentSkill> | null;
}

const LEVEL_PLACEHOLDERS: Record<number, string> = {
  1: "What does foundational performance look like?",
  2: "What does functional performance look like?",
  3: "What does proficient performance look like?",
  4: "What does advanced performance look like?",
  5: "What does expert performance look like?",
};

export default function CustomSkillDialog({
  open,
  onOpenChange,
  onSave,
  initialSkill,
}: CustomSkillDialogProps) {
  const [label, setLabel] = useState("");
  const [scopeInclude, setScopeInclude] = useState("");
  const [l1, setL1] = useState("");
  const [l2, setL2] = useState("");
  const [l3, setL3] = useState("");
  const [l4, setL4] = useState("");
  const [l5, setL5] = useState("");
  const [expectedLevel, setExpectedLevel] = useState(3);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLabel(initialSkill?.skill_label || "");
      setScopeInclude(initialSkill?.scope_include || "");
      setL1(initialSkill?.l1_anchor || "");
      setL2(initialSkill?.l2_anchor || "");
      setL3(initialSkill?.l3_anchor || "");
      setL4(initialSkill?.l4_anchor || "");
      setL5(initialSkill?.l5_anchor || "");
      setExpectedLevel(initialSkill?.expected_level ?? 3);
      setError(null);
    }
  }, [open, initialSkill]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError("Skill name is required");
      return;
    }
    if (!l1.trim() || !l2.trim() || !l3.trim() || !l4.trim() || !l5.trim()) {
      setError("All 5 level anchors (L1–L5) are required");
      return;
    }

    onSave({
      ...(initialSkill || {}),
      skill_id: undefined,
      skill_label: label.trim(),
      is_custom: true,
      scope_include: scopeInclude.trim(),
      l1_anchor: l1.trim(),
      l2_anchor: l2.trim(),
      l3_anchor: l3.trim(),
      l4_anchor: l4.trim(),
      l5_anchor: l5.trim(),
      expected_level: expectedLevel,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold">
            {initialSkill ? "Edit Custom Skill" : "Add Custom Skill"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-1 space-y-4">
            {error && (
              <div className="p-2.5 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="custom-dialog-skill-label">
                Skill Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="custom-dialog-skill-label"
                placeholder="e.g. Internal Infrastructure & Tooling"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="custom-dialog-scope-include">
                What counts (Scope Include)
              </Label>
              <Textarea
                id="custom-dialog-scope-include"
                placeholder="Key expectations, technologies, or responsibilities included in this skill..."
                rows={2}
                value={scopeInclude}
                onChange={(e) => setScopeInclude(e.target.value)}
              />
            </div>


            <div className="space-y-2.5">
              <Label>
                Proficiency Level Anchors (L1–L5) <span className="text-destructive">*</span>
              </Label>
              {[
                { level: 1, val: l1, set: setL1 },
                { level: 2, val: l2, set: setL2 },
                { level: 3, val: l3, set: setL3 },
                { level: 4, val: l4, set: setL4 },
                { level: 5, val: l5, set: setL5 },
              ].map(({ level, val, set }) => (
                <div key={level} className="space-y-1">
                  <Label htmlFor={`custom-dialog-l${level}`} className="text-xs text-muted-foreground">
                    Level {level} Anchor
                  </Label>
                  <Textarea
                    id={`custom-dialog-l${level}`}
                    placeholder={LEVEL_PLACEHOLDERS[level]}
                    rows={2}
                    value={val}
                    onChange={(e) => set(e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1.5 pt-1">
              <Label>Expected Target Level</Label>
              <LevelRadio
                value={expectedLevel}
                onChange={setExpectedLevel}
                idPrefix="custom-dialog-level"
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {initialSkill ? "Save Changes" : "Add Skill"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
