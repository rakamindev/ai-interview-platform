import { useState, useEffect } from "react";
import { Search, Loader2, X, Sparkles, BookOpen } from "lucide-react";
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-3xl border border-emerald-500/20 bg-white/98 backdrop-blur-xl shadow-2xl overflow-hidden transition-all">
        {/* Top edge emerald neon line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                <BookOpen className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Skill Taxonomy Library</h2>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Select standard industry competencies with pre-configured L1–L5 evaluation rubrics.
          </p>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              placeholder="Search taxonomy skills..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all"
            />
          </div>
        </div>

        {/* List */}
        <div className="px-3 py-3 max-h-80 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              <p className="text-xs text-slate-400">Loading skill catalog...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm font-medium text-slate-600">No skills found</p>
              <p className="text-xs text-slate-400 mt-1">Try another keyword or add a custom skill instead.</p>
            </div>
          ) : (
            filtered.map((s) => (
              <button
                key={s.skill_id}
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-emerald-50/70 hover:border-emerald-300 border border-transparent transition-all group cursor-pointer flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">
                    {s.skill_label}
                  </p>
                  {s.scope_include && (
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 max-w-sm">
                      {s.scope_include}
                    </p>
                  )}
                </div>
                <span className="text-xs font-semibold text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  Add +
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
