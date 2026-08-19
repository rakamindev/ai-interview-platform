import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, MessageSquareQuote, CheckCircle2, AlertTriangle, TrendingUp, History } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  expectedLevel?: number;
  onOverrideSaved: (override: AssessorOverride) => void;
  onEvidenceClick?: (quote: string) => void;
  canEdit?: boolean;
}

export default function SkillPortfolioCard({
  skill,
  override,
  expectedLevel,
  onOverrideSaved,
  onEvidenceClick,
  canEdit = true,
}: SkillPortfolioCardProps) {
  const aiLevelNum = parseLevel(skill.ai_level);
  const effectiveLevel = override?.override_level ?? aiLevelNum;

  const levelDelta = expectedLevel ? effectiveLevel - expectedLevel : null;

  return (
    <Card className="shadow-xs hover:border-primary/30 transition-all">
      <CardContent className="p-4 space-y-4">
        {/* Skill Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
          <div className="flex items-center gap-3">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold text-[10px]">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ConfidenceIndicator confidence={skill.ai_confidence} />
                {override && (
                  <span className="text-[10px] text-primary font-medium flex items-center gap-1">
                    <History className="h-3 w-3" /> Overridden from L{aiLevelNum}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Expected vs Actual & Override Panel */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {expectedLevel !== undefined && (
              <div className="flex items-center gap-1.5 text-xs bg-muted/60 border px-2.5 py-1 rounded-lg">
                <span className="text-muted-foreground text-[11px]">Expected: <strong>L{expectedLevel}</strong></span>
                {levelDelta !== null && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    {levelDelta === 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                        <CheckCircle2 className="h-3 w-3" /> Match
                      </span>
                    )}
                    {levelDelta > 0 && (
                      <span className="text-teal-600 dark:text-teal-400 font-bold flex items-center gap-0.5">
                        <TrendingUp className="h-3 w-3" /> +{levelDelta} Exceed
                      </span>
                    )}
                    {levelDelta < 0 && (
                      <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5">
                        <AlertTriangle className="h-3 w-3" /> {levelDelta} Gap
                      </span>
                    )}
                  </>
                )}
              </div>
            )}

            {canEdit && (
              <OverridePanel
                skill={skill}
                existingOverride={override}
                onSaved={onOverrideSaved}
              />
            )}
          </div>
        </div>

        {/* Low Confidence Warning */}
        {skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="text-xs text-amber-800 dark:text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
            Only briefly explored during the session. Evaluated with low confidence — further probing recommended if critical.
          </div>
        )}

        {/* Evidence Quotes */}
        {skill.evidence && skill.evidence.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquareQuote className="h-3.5 w-3.5 text-primary" />
              Evidence from Interview
            </span>
            <div className="space-y-1.5">
              {skill.evidence.map((quote, i) => (
                <div
                  key={i}
                  onClick={() => onEvidenceClick?.(quote)}
                  className={`p-2.5 rounded-xl text-xs bg-muted/40 border transition-colors leading-relaxed ${
                    onEvidenceClick ? "cursor-pointer hover:bg-primary/5 hover:border-primary/30" : ""
                  }`}
                >
                  <p className="text-foreground italic">
                    "{quote}"
                  </p>
                  {onEvidenceClick && (
                    <span className="text-[10px] text-primary font-medium mt-1 block">
                      Jump to transcript turn &rarr;
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competency Summary */}
        {skill.competency_summary && (
          <div className="space-y-1 pt-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Competency Evaluation Summary
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {skill.competency_summary}
            </p>
          </div>
        )}

        {/* Override Notes */}
        {override?.assessor_notes && (
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-primary text-[11px]">Assessor Override Justification</span>
              {override.overridden_at && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(override.overridden_at).toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-foreground text-xs leading-relaxed">{override.assessor_notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
