import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/page";
import { Search, Loader2 } from "lucide-react";
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
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(false);
    skillTaxonomiesApi
      .list()
      .then((res) => { if (active) setSkills(res.data.skill_taxonomies ?? []); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, attempt]);

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
          <DialogDescription>Search the taxonomy and choose a skill to add to this assessment.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search skills"
            placeholder="Search skills..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
          {loading ? (
            <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              Loading skills
            </div>
          ) : error ? (
            <ErrorState message="Couldn't load the skill taxonomy." onRetry={() => setAttempt((value) => value + 1)} />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No skills found.</p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.skill_id}
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted focus-visible:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 transition-colors duration-150 text-sm"
              >
                {s.skill_label}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
