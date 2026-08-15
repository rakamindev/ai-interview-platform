import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Layers, Check } from "lucide-react";
import { LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { AssessmentSkill } from "@/types";

interface CustomSkillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<AssessmentSkill> | null;
  onSave: (skill: Partial<AssessmentSkill>) => void;
}

const LEVEL_GUIDELINES: Record<number, string> = {
  1: "Foundational — Needs significant guidance, learns in familiar contexts, basic familiarity.",
  2: "Functional — Applies with standard assistance, handles routine tasks, knows core tools.",
  3: "Proficient — Independent execution, resolves ambiguities, solid problem solving.",
  4: "Advanced — Technical leadership, mentors others, designs scalable solutions.",
  5: "Expert — Strategic mastery, sets organizational direction, pushes industry standards.",
};

export default function CustomSkillModal({
  open,
  onOpenChange,
  initialData,
  onSave,
}: CustomSkillModalProps) {
  const [skillLabel, setSkillLabel] = useState("");
  const [scopeInclude, setScopeInclude] = useState("");
  const [expectedLevel, setExpectedLevel] = useState(3);
  const [activeTab, setActiveTab] = useState<number>(3);
  const [anchors, setAnchors] = useState<Record<number, string>>({
    1: "",
    2: "",
    3: "",
    4: "",
    5: "",
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        setSkillLabel(initialData.skill_label || "");
        setScopeInclude(initialData.scope_include || "");
        setExpectedLevel(initialData.expected_level ?? 3);
        setActiveTab(initialData.expected_level ?? 3);
        setAnchors({
          1: initialData.l1_anchor || "",
          2: initialData.l2_anchor || "",
          3: initialData.l3_anchor || "",
          4: initialData.l4_anchor || "",
          5: initialData.l5_anchor || "",
        });
      } else {
        setSkillLabel("");
        setScopeInclude("");
        setExpectedLevel(3);
        setActiveTab(3);
        setAnchors({ 1: "", 2: "", 3: "", 4: "", 5: "" });
      }
    }
  }, [open, initialData]);

  const handleAnchorChange = (level: number, text: string) => {
    setAnchors((prev) => ({ ...prev, [level]: text }));
  };

  const isFormValid =
    Boolean(skillLabel.trim()) &&
    Boolean(scopeInclude.trim()) &&
    Boolean(anchors[1]?.trim()) &&
    Boolean(anchors[2]?.trim()) &&
    Boolean(anchors[3]?.trim()) &&
    Boolean(anchors[4]?.trim()) &&
    Boolean(anchors[5]?.trim());

  const handleSave = () => {
    if (!isFormValid) return;
    onSave({
      ...(initialData || {}),
      skill_label: skillLabel.trim(),
      scope_include: scopeInclude.trim(),
      expected_level: expectedLevel,
      is_custom: true,
      l1_anchor: anchors[1].trim(),
      l2_anchor: anchors[2].trim(),
      l3_anchor: anchors[3].trim(),
      l4_anchor: anchors[4].trim(),
      l5_anchor: anchors[5].trim(),
    });
    onOpenChange(false);
  };

  const filledAnchorsCount = [1, 2, 3, 4, 5].filter((l) => Boolean(anchors[l]?.trim())).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {initialData?.skill_label ? "Edit Custom Skill" : "Add Custom Skill"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Define the competency rubric and behavioral anchor criteria for the AI interviewer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Skill Name */}
          <div className="space-y-1.5">
            <Label htmlFor="custom-skill-name" className="text-sm font-semibold">
              Skill / Competency Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="custom-skill-name"
              placeholder="e.g. Next.js App Architecture, Client Relationship Management"
              value={skillLabel}
              onChange={(e) => setSkillLabel(e.target.value)}
              className="h-10 text-sm"
              autoFocus
            />
          </div>

          {/* Scope / What counts */}
          <div className="space-y-1.5">
            <Label htmlFor="custom-scope" className="text-sm font-semibold">
              What Counts (Scope &amp; Topics) <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="custom-scope"
              placeholder="e.g. Component architecture, SSR/SSG caching strategies, state management, bundle size optimization..."
              rows={2}
              value={scopeInclude}
              onChange={(e) => setScopeInclude(e.target.value)}
              className="text-sm resize-none"
            />
            <p className="text-[11px] text-muted-foreground">
              Guide the AI on specific sub-topics and practical concepts to evaluate.
            </p>
          </div>

          {/* Expected Target Level */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <Label className="text-sm font-semibold block">
              Target Level for this Assessment <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((lvl) => {
                const isSelected = expectedLevel === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setExpectedLevel(lvl)}
                    className={cn(
                      "p-2 rounded-xl text-center border transition-all text-xs font-semibold",
                      isSelected
                        ? "bg-primary text-white border-primary shadow-xs ring-2 ring-primary/20"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    )}
                  >
                    <span className="block">{LEVEL_LABELS[lvl]}</span>
                    <span className={cn("text-[10px] font-normal block truncate", isSelected ? "text-primary-foreground/90" : "text-muted-foreground")}>
                      {LEVEL_DESCRIPTIONS[lvl]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* L1 - L5 Anchor Rubrics (Tabbed UI) */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-primary" />
                Proficiency Level Rubrics (Anchors) <span className="text-destructive">*</span>
              </Label>
              <Badge variant="outline" className="text-xs font-medium">
                {filledAnchorsCount}/5 Levels defined
              </Badge>
            </div>

            {/* Level Tab Bar */}
            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              {[1, 2, 3, 4, 5].map((lvl) => {
                const isActive = activeTab === lvl;
                const isFilled = Boolean(anchors[lvl]?.trim());
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setActiveTab(lvl)}
                    className={cn(
                      "flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1",
                      isActive
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <span>{LEVEL_LABELS[lvl]}</span>
                    {isFilled && <Check className="h-3 w-3 text-emerald-600" />}
                  </button>
                );
              })}
            </div>

            {/* Active Level Rubric Input */}
            <div className="space-y-2 p-3.5 bg-slate-50/60 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Level {activeTab}: {LEVEL_DESCRIPTIONS[activeTab]} Anchor
                </span>
                <span className="text-[11px] text-muted-foreground italic">
                  {LEVEL_GUIDELINES[activeTab]}
                </span>
              </div>
              <Textarea
                placeholder={`Describe how candidate demonstrates Level ${activeTab} proficiency...`}
                rows={3}
                value={anchors[activeTab]}
                onChange={(e) => handleAnchorChange(activeTab, e.target.value)}
                className="text-sm bg-white"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isFormValid}
            className="bg-primary text-white font-semibold shadow-xs"
          >
            {initialData?.skill_label ? "Save Changes" : "Add to Assessment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
