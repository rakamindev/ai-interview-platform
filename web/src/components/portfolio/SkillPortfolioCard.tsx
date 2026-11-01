import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, ChevronDown, ChevronUp, Quote, AlertTriangle } from "lucide-react";
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
  const [expandedQuotes, setExpandedQuotes] = useState<Record<number, boolean>>({});
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);
  const isUnassessed = !skill.ai_level || skill.ai_level.trim() === "";

  const toggleQuote = (index: number) => {
    setExpandedQuotes((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <Card className="overflow-hidden border-border/80 hover:border-primary/40 transition-all shadow-2xs">
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Skill header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {isUnassessed ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" /> Pending
              </span>
            ) : (
              <LevelBadge level={effectiveLevel} />
            )}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm sm:text-base text-foreground break-words">
                  {skill.skill_label}
                </span>
                {skill.is_discovered && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <Zap className="h-3 w-3 text-amber-500 fill-amber-500" /> Discovered
                  </span>
                )}
                {override && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-50 text-purple-700 border border-purple-200">
                    Overridden
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
            </div>
          </div>

          <div className="self-end sm:self-auto">
            <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
          </div>
        </div>

        {/* Low confidence notice */}
        {skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="text-xs text-amber-900 bg-amber-50/90 border border-amber-200/80 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Limited dialogue signals captured for this skill. Confidence is low — a dedicated follow-up interview is recommended if this role competency is critical.
            </span>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1 bg-muted/30 rounded-lg p-3 border border-border/50">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Evaluator Synthesis
            </span>
            <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed break-words whitespace-normal">
              {skill.competency_summary}
            </p>
          </div>
        )}

        {/* Evidence Quotes */}
        {skill.evidence && skill.evidence.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Quote className="h-3 w-3" />
              Interview Excerpts &amp; Evidence ({skill.evidence.length})
            </span>

            <div className="space-y-2">
              {skill.evidence.map((quote, i) => {
                const isLong = quote.length > 180;
                const isExpanded = !!expandedQuotes[i];

                return (
                  <div
                    key={i}
                    className="relative rounded-lg border bg-background/80 p-3 text-xs sm:text-sm shadow-2xs hover:border-primary/30 transition-colors"
                  >
                    <p
                      className={`text-foreground/90 leading-relaxed break-words whitespace-normal font-sans italic ${
                        isLong && !isExpanded ? "line-clamp-3" : ""
                      }`}
                    >
                      "{quote}"
                    </p>

                    {isLong && (
                      <button
                        onClick={() => toggleQuote(i)}
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                      >
                        {isExpanded ? (
                          <>
                            Show less <ChevronUp className="h-3 w-3" />
                          </>
                        ) : (
                          <>
                            Read full response <ChevronDown className="h-3 w-3" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
