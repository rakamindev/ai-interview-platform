import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, BookOpen, Check, Sparkles } from "lucide-react";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import type { AssessmentSkill, SkillTaxonomy } from "@/types";
import { cn } from "@/lib/utils";

interface SkillPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (skill: Partial<AssessmentSkill>) => void;
}

export default function SkillPicker({ open, onOpenChange, onSelect }: SkillPickerProps) {
  const [skills, setSkills] = useState<SkillTaxonomy[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

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

  const categories = useMemo(() => {
    const set = new Set<string>();
    skills.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return ["all", ...Array.from(set)];
  }, [skills]);

  const filtered = useMemo(() => {
    return skills.filter((s) => {
      const matchesQuery =
        s.skill_label.toLowerCase().includes(query.toLowerCase()) ||
        s.category?.toLowerCase().includes(query.toLowerCase()) ||
        s.scope_include?.toLowerCase().includes(query.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || s.category === selectedCategory;
      return matchesQuery && matchesCategory;
    });
  }, [skills, query, selectedCategory]);

  const handleSelect = (s: SkillTaxonomy) => {
    onSelect({
      skill_id: undefined,
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl p-6 border-slate-200">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <BookOpen className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              B7 Skill Taxonomy Library
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Pilih kompetensi standar industri yang telah dilengkapi rubrik evaluasi level L1–L5.
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative mt-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cari skill, framework, atau domain (contoh: System Design, React)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-slate-50 border-slate-200 text-sm focus:bg-white"
            autoFocus
          />
        </div>

        {/* Category Pills */}
        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap",
                  selectedCategory === cat
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                )}
              >
                {cat === "all" ? "Semua Kategori" : cat}
              </button>
            ))}
          </div>
        )}

        {/* Skill Items List */}
        <div className="mt-1 max-h-72 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
              <p className="text-xs text-slate-500 font-medium">Memuat taksonomi skill...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm font-semibold text-slate-700">Tidak ada skill yang cocok</p>
              <p className="text-xs text-slate-500 mt-1">
                Gunakan kata kunci lain atau tambahkan sebagai custom skill.
              </p>
            </div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.skill_id}
                onClick={() => handleSelect(s)}
                className="group flex flex-col p-3 rounded-xl border border-slate-200/80 hover:border-teal-500/80 hover:bg-teal-50/30 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-sm text-slate-900 group-hover:text-teal-900 truncate">
                      {s.skill_label}
                    </span>
                    {s.category && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-slate-50 text-slate-600 border-slate-200">
                        {s.category}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-teal-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 shrink-0">
                    Pilih
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </div>
                {s.scope_include && (
                  <p className="text-xs text-slate-500 line-clamp-1 mt-1 group-hover:text-slate-600">
                    {s.scope_include}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
