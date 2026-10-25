import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ result }: { result: string }) {
  const map: Record<string, { label: string; classes: string; icon: string }> = {
    match: { label: "Match", classes: "bg-teal-50 text-teal-700 border border-teal-200", icon: "✓" },
    gap: { label: "Gap", classes: "bg-red-50 text-red-700 border border-red-200", icon: "" },
    exceed: { label: "Exceeds", classes: "bg-blue-50 text-blue-700 border border-blue-200", icon: "+" },
    missing: { label: "Not assessed", classes: "bg-gray-50 text-gray-500 border border-gray-200", icon: "" },
  };
  const m = map[result] ?? map.missing;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full", m.classes)}>
      {m.icon && <span className="text-[10px]">{m.icon}</span>}
      {m.label}
    </span>
  );
}

function GapChip({ expected, candidate, result }: { expected: number; candidate: number | undefined; result: string }) {
  if (result === "match" || candidate == null) return null;
  const diff = expected - candidate;
  if (diff <= 0) return null;
  return (
    <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5 font-medium">
      −{diff} level{diff !== 1 ? "s" : ""}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          Skill-by-skill comparison
        </h2>
      </div>

      <div className="space-y-0">
        {comparisons.map((c, i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-b-0">
            <span className="flex-1 text-sm font-medium text-gray-900">{c.skill_label}</span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 font-medium bg-gray-50 rounded-full px-2 py-0.5 border border-gray-200">
              Required: {LEVEL_LABELS[c.expected_level]}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 bg-white border border-gray-200">
              Candidate: {c.candidate_level != null ? LEVEL_LABELS[c.candidate_level] : "—"}
              {c.is_override && <span className="text-[9px] text-gray-400">✏</span>}
            </span>
            <ResultBadge result={c.result} />
            <GapChip expected={c.expected_level} candidate={c.candidate_level} result={c.result} />
          </div>
        ))}
      </div>

      {/* Table footer */}
      <div className="flex items-center gap-4 text-xs text-gray-500 border-t border-gray-200 pt-3 mt-2">
        {matchCount > 0 && <span className="text-teal-700 font-medium">✓ Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}</span>}
        {gapCount > 0 && <span className="text-red-600 font-medium">Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}</span>}
        {exceedCount > 0 && <span className="text-blue-700 font-medium">Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}</span>}
      </div>
    </div>
  );
}
