import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, ChevronDown, ChevronUp, Quote } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved?: (override: AssessorOverride) => void;
  onSaveOverride?: (overrideLevel: number, notes: string) => Promise<void> | void;
}

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
  onSaveOverride,
}: SkillPortfolioCardProps) {
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);
  const isOverridden = !!override;
  const [showAllQuotes, setShowAllQuotes] = useState(false);

  const rawQuotes = skill.evidence || [];
  const quotes: string[] = Array.isArray(rawQuotes)
    ? rawQuotes
    : typeof rawQuotes === "string"
    ? (function () {
        try {
          const parsed = JSON.parse(rawQuotes);
          return Array.isArray(parsed) ? parsed : [rawQuotes];
        } catch {
          return [rawQuotes];
        }
      })()
    : [];
  const displayQuotes = showAllQuotes ? quotes : quotes.slice(0, 2);

  return (
    <Card className="overflow-hidden border transition-all hover:shadow-sm">
      <CardContent className="p-5 space-y-4">
        {/* Skill Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-base text-foreground leading-tight">
                  {skill.skill_label}
                </span>
                {skill.is_discovered && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                    <Zap className="h-3 w-3 text-amber-600" /> Discovered
                  </span>
                )}
                {isOverridden && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full">
                    ✏ AI: L{skill.ai_level} → L{override.override_level}
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>
          <OverridePanel
            skill={skill}
            existingOverride={override}
            onSaved={onOverrideSaved}
            onSaveOverride={onSaveOverride ? (lvl, notes) => onSaveOverride(lvl, notes) : undefined}
          />
        </div>

        {/* Low confidence callout */}
        {String(skill.ai_confidence).toLowerCase() === "low" && (
          <div className="text-xs text-amber-800 bg-amber-50/80 border border-amber-200/80 rounded-md p-2.5 leading-relaxed">
            <strong>Limited Signal:</strong> Only briefly probed during the interview. Consider a targeted follow-up session if this skill is core to the vacancy.
          </div>
        )}

        {/* Competency Summary */}
        {skill.competency_summary && (
          <div className="space-y-1.5 pt-1 border-t border-border/50">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Competency Synthesis
            </span>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {skill.competency_summary}
            </p>
          </div>
        )}

        {/* Evidence from interview */}
        {quotes.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Quote className="h-3 w-3" /> Verbatim Interview Evidence
              </span>
              {quotes.length > 2 && (
                <button
                  type="button"
                  onClick={() => setShowAllQuotes(!showAllQuotes)}
                  className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                >
                  {showAllQuotes ? (
                    <>Show less <ChevronUp className="h-3 w-3" /></>
                  ) : (
                    <>+{quotes.length - 2} more <ChevronDown className="h-3 w-3" /></>
                  )}
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {displayQuotes.map((quote, i) => (
                <li
                  key={i}
                  className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded border border-border/40 italic leading-relaxed"
                >
                  "{quote}"
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Assessor Notes (if overridden) */}
        {isOverridden && override.assessor_notes && (
          <div className="text-xs bg-purple-50/60 border border-purple-200/70 text-purple-900 rounded p-2.5 space-y-0.5">
            <span className="font-semibold block">Assessor Calibration Rationale:</span>
            <p className="italic text-purple-800">{override.assessor_notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
