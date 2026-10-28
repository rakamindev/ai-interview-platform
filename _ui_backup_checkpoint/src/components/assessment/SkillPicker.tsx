import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Plus } from "lucide-react";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import { ALL_B7_TAXONOMY_SKILLS } from "@/data/b7SkillsData";
import type { AssessmentSkill, SkillTaxonomy } from "@/types";

interface SkillPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (skill: Partial<AssessmentSkill>) => void;
}

const CATEGORIES = ["All", "Engineering", "Finance", "Marketing", "Management", "General"];

export default function SkillPicker({ open, onOpenChange, onSelect }: SkillPickerProps) {
  const [skills, setSkills] = useState<SkillTaxonomy[]>(ALL_B7_TAXONOMY_SKILLS);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    skillTaxonomiesApi
      .list()
      .then((res) => {
        const loaded = res.data.skill_taxonomies ?? [];
        if (loaded.length > 0) {
          // Merge loaded skills with predefined taxonomy for rich coverage
          const existingIds = new Set(loaded.map((s) => s.skill_id));
          const additions = ALL_B7_TAXONOMY_SKILLS.filter((s) => !existingIds.has(s.skill_id));
          setSkills([...loaded, ...additions]);
        } else {
          setSkills(ALL_B7_TAXONOMY_SKILLS);
        }
      })
      .catch(() => {
        setSkills(ALL_B7_TAXONOMY_SKILLS);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const trimmedQuery = query.trim();

  const filtered = useMemo(() => {
    return skills.filter((s) => {
      const matchesQuery =
        !trimmedQuery ||
        s.skill_label.toLowerCase().includes(trimmedQuery.toLowerCase()) ||
        (s.skill_id && s.skill_id.toLowerCase().includes(trimmedQuery.toLowerCase()));

      const matchesCat =
        selectedCategory === "All" ||
        (s.category && s.category.toLowerCase().includes(selectedCategory.toLowerCase()));

      return matchesQuery && matchesCat;
    });
  }, [skills, trimmedQuery, selectedCategory]);

  const handleSelectTaxonomy = (s: SkillTaxonomy) => {
    onSelect({
      skill_id: s.skill_id,
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
    setSelectedCategory("All");
  };

  const handleSelectCustom = (customLabel: string) => {
    onSelect({
      skill_id: undefined,
      skill_label: customLabel.trim(),
      is_custom: true,
      expected_level: 3,
    });
    onOpenChange(false);
    setQuery("");
    setSelectedCategory("All");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            Choose Skills
          </DialogTitle>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search skills (e.g. React, Budgeting, SEO, Python, Troubleshooting)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-white"
            autoFocus
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-primary text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Skills List */}
        <div className="mt-2 max-h-72 overflow-y-auto space-y-1.5 divide-y divide-slate-100 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 px-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                No predefined skills found matching "{query}".
              </p>
              {trimmedQuery && (
                <Button
                  type="button"
                  size="sm"
                  className="text-xs bg-primary text-white hover:bg-primary/90"
                  onClick={() => handleSelectCustom(trimmedQuery)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Create "{trimmedQuery}" as Custom Skill
                </Button>
              )}
            </div>
          ) : (
            filtered.map((s) => (
              <button
                key={s.skill_id}
                type="button"
                onClick={() => handleSelectTaxonomy(s)}
                className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-start justify-between gap-3 group"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900 group-hover:text-primary transition-colors">
                      {s.skill_label}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {s.skill_id}
                    </span>
                  </div>
                  {s.scope_include && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {s.scope_include}
                    </p>
                  )}
                </div>

                <Badge
                  variant="outline"
                  className="text-[10px] shrink-0 font-medium bg-slate-50 border-slate-200 text-slate-600"
                >
                  {s.category || "General"}
                </Badge>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
