import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import type { AssessmentSkill, SkillTaxonomy } from "@/types";

interface SkillPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (skills: Partial<AssessmentSkill>[]) => void;
  selectedLabels?: string[];
}

export default function SkillPicker({
  open,
  onOpenChange,
  onSelect,
  selectedLabels = [],
}: SkillPickerProps) {
  const [skills, setSkills] = useState<SkillTaxonomy[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [stagedSelection, setStagedSelection] = useState<SkillTaxonomy[]>([]);

  useEffect(() => {
    if (open) {
      setStagedSelection([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    skillTaxonomiesApi
      .list()
      .then((res) => setSkills(res.data.skill_taxonomies ?? []))
      .catch((err) => {
        console.error("skill_taxonomies fetch failed:", err);
        setSkills([]);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = skills.filter((s) => s.skill_label.toLowerCase().includes(query.toLowerCase()));

  const toggleSelection = (s: SkillTaxonomy) => {
    if (stagedSelection.some((staged) => staged.skill_id === s.skill_id)) {
      setStagedSelection((prev) => prev.filter((staged) => staged.skill_id !== s.skill_id));
    } else {
      setStagedSelection((prev) => [...prev, s]);
    }
  };

  const handleAdd = () => {
    const skillsToAdd = stagedSelection.map((s) => ({
      skill_id: undefined,
      skill_label: s.skill_label,
      is_custom: false,
      expected_level: 3,
      scope_include: s.scope_include,
      l1_anchor: s.l1_anchor,
      l2_anchor: s.l2_anchor,
      l3_anchor: s.l3_anchor,
      l4_anchor: s.l4_anchor,
      l5_anchor: s.l5_anchor,
    }));
    onSelect(skillsToAdd);
    onOpenChange(false);
    setQuery("");
  };

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
          />
        </div>

        <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No skills found.</p>
          ) : (
            filtered.map((s) => {
              const isAlreadySelected = selectedLabels.includes(s.skill_label);
              const isStaged = stagedSelection.some((staged) => staged.skill_id === s.skill_id);
              const isChecked = isAlreadySelected || isStaged;

              return (
                <label
                  key={s.skill_id}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm ${isAlreadySelected ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : "hover:bg-muted cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isAlreadySelected}
                    onChange={() => !isAlreadySelected && toggleSelection(s)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div className="flex-1 flex justify-between items-center">
                    <span>{s.skill_label}</span>
                    {isAlreadySelected && <span className="text-xs font-medium">Added</span>}
                  </div>
                </label>
              );
            })
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={stagedSelection.length === 0}>
            Add {stagedSelection.length > 0 ? `(${stagedSelection.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
