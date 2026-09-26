import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
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
  const isUnassessed = effectiveLevel == null;
  const [expandedQuotes, setExpandedQuotes] = useState<Record<number, boolean>>({});

  const toggleQuote = (index: number) => {
    setExpandedQuotes((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <Card className={isUnassessed ? "border-dashed border-neutral-300 bg-neutral-50/50" : undefined}>
      <CardContent className="p-4 space-y-4">
        {/* Skill header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-foreground">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
                {isUnassessed && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-neutral-600 bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded">
                    <HelpCircle className="h-3 w-3" /> Unassessed
                  </span>
                )}
              </div>
              {!isUnassessed && skill.ai_confidence && (
                <ConfidenceIndicator confidence={skill.ai_confidence} />
              )}
            </div>
          </div>
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {/* Unassessed guidance */}
        {isUnassessed && (
          <div className="text-xs text-neutral-600 bg-neutral-100/80 border border-neutral-200 rounded px-3 py-2 leading-relaxed">
            Skill was not explored or probed during this interview. In accordance with fair evaluation and Indonesia UU PDP principles, no penalty or arbitrary rating is assigned.
          </div>
        )}

        {/* Low confidence note */}
        {!isUnassessed && skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Only briefly explored. Confidence is low — warrants a follow-up session if this skill is vital for the role.
          </div>
        )}

        {/* Evidence */}
        {skill.evidence && skill.evidence.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Evidence from interview
            </span>
            <ul className="space-y-2">
              {skill.evidence.map((quote, i) => {
                const isLong = quote.length > 180;
                const isExpanded = !!expandedQuotes[i];
                const displayQuote = isLong && !isExpanded ? `${quote.slice(0, 180)}...` : quote;

                return (
                  <li key={i} className="text-sm bg-background/80 border rounded p-2.5 transition-colors">
                    <p className="italic text-foreground">"{displayQuote}"</p>
                    {isLong && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 mt-1 text-xs text-primary font-medium flex items-center gap-1 hover:bg-transparent"
                        onClick={() => toggleQuote(i)}
                      >
                        {isExpanded ? (
                          <>
                            Show less <ChevronUp className="h-3 w-3" />
                          </>
                        ) : (
                          <>
                            Show full quote <ChevronDown className="h-3 w-3" />
                          </>
                        )}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Competency summary
            </span>
            <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 p-2.5 rounded border border-muted">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
