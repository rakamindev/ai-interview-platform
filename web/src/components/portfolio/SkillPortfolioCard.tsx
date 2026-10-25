import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
}

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
}: SkillPortfolioCardProps) {
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);

  return (
    <Card className="relative overflow-visible border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        <div className="relative flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <LevelBadge level={effectiveLevel} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        <div className="grid gap-0 divide-y divide-slate-100 md:grid-cols-[1.1fr_0.9fr] md:divide-x md:divide-y-0">
          {skill.evidence.length > 0 && (
            <div className="space-y-2 px-5 py-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Evidence from interview</span>
              <ul className="space-y-2">
                {skill.evidence.map((quote, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-5 text-slate-700"><span className="mt-0.5 text-primary">“</span><span>{quote}</span></li>
                ))}
              </ul>
            </div>
          )}
          {skill.competency_summary && (
            <div className="space-y-2 bg-slate-50/60 px-5 py-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Competency summary</span>
              <p className="text-sm leading-6 text-slate-600">{skill.competency_summary}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
