import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Trash2 } from "lucide-react";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import { customSkillsApi } from "@/services/customSkills";
import type { AssessmentSkill, CustomSkill, SkillTaxonomy } from "@/types";


interface SkillPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (skill: Partial<AssessmentSkill>) => void;
  /** Labels already added to the current form — hidden so a skill can't be picked twice. */
  selectedLabels?: string[];
}

export default function SkillPicker({ open, onOpenChange, onSelect, selectedLabels = [] }: SkillPickerProps) {
  const [skills, setSkills] = useState<SkillTaxonomy[]>([]);
  const [customSkills, setCustomSkills] = useState<CustomSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([skillTaxonomiesApi.list(), customSkillsApi.list()])
      .then(([taxRes, customRes]) => {
        setSkills(taxRes.data.skill_taxonomies ?? []);
        setCustomSkills(customRes.data.custom_skills ?? []);
      })
      .catch((err) => { console.error("skill fetch failed:", err); setSkills([]); setCustomSkills([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  const isSelected = (label: string) =>
    selectedLabels.some((l) => l?.toLowerCase() === label.toLowerCase());

  const filteredTaxonomy = skills.filter(
    (s) => !isSelected(s.skill_label) && s.skill_label.toLowerCase().includes(query.toLowerCase())
  );
  const filteredCustom = customSkills.filter(
    (s) => !isSelected(s.skill_label) && s.skill_label.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (s: SkillTaxonomy | CustomSkill) => {
    onSelect({
      // skill_id is intentionally omitted: taxonomy ids are non-numeric
      // strings and the backend joins skills by skill_label.
      skill_label: s.skill_label,
      is_custom: !("skill_id" in s),
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

  const handleDeleteCustom = async (id: number) => {
    try {
      await customSkillsApi.destroy(id);
      setCustomSkills((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("delete custom skill failed:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add skill</DialogTitle>
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
          ) : filteredTaxonomy.length === 0 && filteredCustom.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {query ? "No skills found." : "All skills are already added."}
            </p>
          ) : (
            <>
              {filteredTaxonomy.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground px-1 pt-1">B7 taxonomy</p>
                  {filteredTaxonomy.map((s) => (
                    <button
                      key={s.skill_id}
                      type="button"
                      onClick={() => handleSelect(s)}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm"
                    >
                      {s.skill_label}
                    </button>
                  ))}
                </>
              )}

              {filteredCustom.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground px-1 pt-3">Your custom skills</p>
                  {filteredCustom.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center w-full rounded-md hover:bg-muted transition-colors text-sm group"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(s)}
                        className="flex-1 text-left px-3 py-2"
                      >
                        {s.skill_label}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${s.skill_label}`}
                        onClick={() => handleDeleteCustom(s.id)}
                        className="px-2 py-2 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
