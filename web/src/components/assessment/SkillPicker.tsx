import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import type { AssessmentSkill, SkillTaxonomy } from "@/types";


interface SkillPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (skill: Partial<AssessmentSkill>) => void;
  existingSkillLabels?: (string | undefined)[];
}

export default function SkillPicker({ open, onOpenChange, onSelect, existingSkillLabels = [] }: SkillPickerProps) {
  const [skills, setSkills] = useState<SkillTaxonomy[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    skillTaxonomiesApi
      .list()
      .then((res) => setSkills(res.data.skill_taxonomies ?? []))
      .catch((err) => { console.error("skill_taxonomies fetch failed:", err); setSkills([]); })
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = skills.filter((s) =>
    s.skill_label.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (s: SkillTaxonomy) => {
    onSelect({
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
    });
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
              const isAlreadyAdded = existingSkillLabels.some(
                (l) => Boolean(l) && l!.trim().toLowerCase() === s.skill_label.trim().toLowerCase()
              );
              return (
                <button
                  key={s.skill_id}
                  type="button"
                  disabled={isAlreadyAdded}
                  onClick={() => !isAlreadyAdded && handleSelect(s)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors text-sm ${
                    isAlreadyAdded
                      ? "opacity-50 cursor-not-allowed bg-muted/40 text-muted-foreground"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <span>{s.skill_label}</span>
                  {isAlreadyAdded && (
                    <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded border text-muted-foreground font-normal">
                      Added
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
