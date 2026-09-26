import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, ChevronDown, ChevronUp, Plus, Info, Check } from "lucide-react";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import type { AssessmentSkill, SkillTaxonomy } from "@/types";

interface SkillPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (skill: Partial<AssessmentSkill>) => void;
  existingSkillIds?: string[];
}

const CATEGORIES = [
  { id: "all", label: "All Skills" },
  { id: "engineering", label: "Engineering" },
  { id: "soft_skills", label: "Soft Skills" },
  { id: "product_process", label: "Product & Process" },
] as const;

export default function SkillPicker({ open, onOpenChange, onSelect, existingSkillIds = [] }: SkillPickerProps) {
  const [skills, setSkills] = useState<SkillTaxonomy[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    skillTaxonomiesApi
      .list()
      .then((res) => setSkills(res.data.skill_taxonomies ?? []))
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = skills.filter((s) => {
    const matchesCategory = selectedCategory === "all" || s.category === selectedCategory;
    const matchesQuery =
      s.skill_label.toLowerCase().includes(query.toLowerCase()) ||
      s.skill_id.toLowerCase().includes(query.toLowerCase()) ||
      Boolean(s.scope_include && s.scope_include.toLowerCase().includes(query.toLowerCase()));
    return matchesCategory && matchesQuery;
  });

  const handleSelect = (s: SkillTaxonomy) => {
    if (existingSkillIds.includes(s.skill_id)) return;
    onSelect({
      skill_id: s.skill_id,
      skill_label: s.skill_label,
      is_custom: false,
      expected_level: 3,
      scope_include: s.scope_include,
      scope_exclude: s.scope_exclude,
      l1_anchor: s.l1_anchor,
      l2_anchor: s.l2_anchor,
      l3_anchor: s.l3_anchor,
      l4_anchor: s.l4_anchor,
      l5_anchor: s.l5_anchor,
    });
    onOpenChange(false);
    setQuery("");
    setExpandedSkillId(null);
  };

  const toggleExpand = (skillId: string) => {
    setExpandedSkillId((prev) => (prev === skillId ? null : skillId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold">Add from B7 Skill Taxonomy</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by skill name or keyword..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.id}
                type="button"
                variant={selectedCategory === cat.id ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs rounded-full"
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-sm font-medium">No skills found</p>
              <p className="text-xs mt-1">Try adjusting your keyword or category filter.</p>
            </div>
          ) : (
            filtered.map((s) => {
              const isExpanded = expandedSkillId === s.skill_id;
              const isAdded = existingSkillIds.includes(s.skill_id);
              return (
                <div
                  key={s.skill_id}
                  className="border rounded-lg p-3 bg-card hover:border-primary/50 transition-colors space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{s.skill_label}</span>
                        <span className="text-[11px] text-muted-foreground capitalize">
                          {s.category.replace(/_/g, " ")}
                        </span>
                      </div>
                      {s.scope_include && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{s.scope_include}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => toggleExpand(s.skill_id)}
                        aria-label={isExpanded ? "Hide details" : "Preview details"}
                      >
                        <Info className="h-3.5 w-3.5 mr-1" />
                        Detail
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 ml-1" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 ml-1" />
                        )}
                      </Button>

                      {isAdded ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-8 text-xs opacity-75 cursor-not-allowed"
                          disabled
                        >
                          <Check className="h-3.5 w-3.5 mr-1 text-green-600" />
                          Added
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleSelect(s)}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Add
                        </Button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="rounded-md bg-muted/60 p-3 text-xs space-y-2.5 border border-border/50">
                      <div className="space-y-1">
                        <span className="font-semibold text-foreground block">Proficiency Levels (L1–L5):</span>
                        <div className="space-y-1 pl-1">
                          <div>
                            <span className="font-medium text-primary">L1 (Foundational): </span>
                            <span className="text-muted-foreground">{s.l1_anchor}</span>
                          </div>
                          <div>
                            <span className="font-medium text-primary">L2 (Functional): </span>
                            <span className="text-muted-foreground">{s.l2_anchor}</span>
                          </div>
                          <div>
                            <span className="font-medium text-primary">L3 (Proficient): </span>
                            <span className="text-muted-foreground">{s.l3_anchor}</span>
                          </div>
                          <div>
                            <span className="font-medium text-primary">L4 (Advanced): </span>
                            <span className="text-muted-foreground">{s.l4_anchor}</span>
                          </div>
                          <div>
                            <span className="font-medium text-primary">L5 (Expert): </span>
                            <span className="text-muted-foreground">{s.l5_anchor}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
