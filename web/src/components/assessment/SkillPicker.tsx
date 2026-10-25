import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { skillTaxonomyKeys } from "@/lib/queryKeys";


interface SkillPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (skill: Partial<AssessmentSkill>) => void;
}

export default function SkillPicker({ open, onOpenChange, onSelect }: SkillPickerProps) {
  const [query, setQuery] = useState("");

  const { data: skills = [], isPending, isError } = useQuery({
    queryKey: skillTaxonomyKeys.list(),
    queryFn: async () => (await skillTaxonomiesApi.list()).data.skill_taxonomies ?? [],
    enabled: open,
    staleTime: 5 * 60_000,
  });

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
          {isPending ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive text-center py-6">
              Failed to load skills. Close and reopen this dialog to retry.
            </p>
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
}
