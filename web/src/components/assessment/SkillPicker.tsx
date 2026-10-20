import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Plus } from "lucide-react";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import type { AssessmentSkill, SkillTaxonomy } from "@/types";

interface SkillPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (skill: Partial<AssessmentSkill>) => void;
}

export default function SkillPicker({ open, onOpenChange, onSelect }: SkillPickerProps) {
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
      <DialogContent className="max-w-lg rounded-none border border-border shadow-lg p-6">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-base font-bold text-foreground">
            Add from Skill Taxonomy
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Select a verified competency from the standardized taxonomy database.
          </p>
        </DialogHeader>

        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search competencies (e.g. React, SQL, Problem Solving)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 text-sm rounded-none"
            autoFocus
          />
        </div>

        <div className="mt-3 max-h-72 overflow-y-auto divide-y border bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No matching skills found in taxonomy.
            </div>
          ) : (
            filtered.map((s) => (
              <button
                key={s.skill_id}
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full text-left px-3.5 py-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between group cursor-pointer"
              >
                <div className="min-w-0 pr-3">
                  <div className="font-semibold text-sm text-foreground truncate">
                    {s.skill_label}
                  </div>
                  {s.scope_include && (
                    <div className="text-xs text-muted-foreground truncate line-clamp-1 mt-0.5">
                      {s.scope_include}
                    </div>
                  )}
                </div>
                <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                  <Plus className="h-3.5 w-3.5" /> Add
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
