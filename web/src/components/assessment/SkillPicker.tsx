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
  onSelect: (skill: Partial<AssessmentSkill>, taxonomy: SkillTaxonomy) => void;
}

export default function SkillPicker({ open, onOpenChange, onSelect }: SkillPickerProps) {
  const [skills, setSkills] = useState<SkillTaxonomy[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setLoadError(false);
    skillTaxonomiesApi
      .list()
      .then((res) => setSkills(res.data.skill_taxonomies ?? []))
      .catch(() => { console.error("skill_taxonomies fetch failed:"); setSkills([]); setLoadError(true); })
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
    }, s);
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add from skill taxonomy</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search skills by name"
            autoComplete="off"
            placeholder="Search skills"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div role="status" className="flex flex-col items-center gap-2 py-8">
              <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading skills</p>
            </div>
          ) : loadError ? (
            <p role="alert" className="py-6 text-center text-sm text-destructive">
              The skill taxonomy could not be loaded. Close this and try again.
            </p>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm font-medium">No skills found</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                {query.trim()
                  ? `Nothing matches "${query.trim()}". Try a shorter search term.`
                  : "The taxonomy is empty. Add the skill as a custom skill instead."}
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((s) => (
                <li key={s.skill_id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(s)}
                    className="min-h-11 w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {s.skill_label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
