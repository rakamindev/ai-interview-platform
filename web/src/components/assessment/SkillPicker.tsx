import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import LoadError from "@/components/LoadError";
import { Search, Loader2 } from "lucide-react";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import { getApiErrorMessage } from "@/lib/apiError";
import type { AssessmentSkill, SkillTaxonomy } from "@/types";

interface SkillPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (skill: Partial<AssessmentSkill>) => void;
  // Labels already on the form; those skills are shown but cannot be added twice.
  addedLabels?: string[];
}

export default function SkillPicker({
  open,
  onOpenChange,
  onSelect,
  addedLabels = [],
}: SkillPickerProps) {
  const [skills, setSkills] = useState<SkillTaxonomy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const loadSkills = useCallback(() => {
    setLoading(true);
    setError(null);
    skillTaxonomiesApi
      .list()
      .then((res) => setSkills(res.data.skill_taxonomies ?? []))
      .catch((requestError: unknown) => {
        setSkills([]);
        setError(getApiErrorMessage(requestError, "Failed to load skills."));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) loadSkills();
  }, [open, loadSkills]);

  const filtered = skills.filter((s) => s.skill_label.toLowerCase().includes(query.toLowerCase()));
  const added = new Set(addedLabels.map((label) => label.trim().toLowerCase()));

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

        <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <LoadError message={error} onRetry={loadSkills} />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No skills found.</p>
          ) : (
            filtered.map((s) => {
              const isAdded = added.has(s.skill_label.trim().toLowerCase());
              return (
                <button
                  key={s.skill_id}
                  type="button"
                  onClick={() => handleSelect(s)}
                  disabled={isAdded}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-rakamin-light-cyan disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                >
                  <span>{s.skill_label}</span>
                  {isAdded && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
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
