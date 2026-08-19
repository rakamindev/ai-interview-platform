import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, AlertCircle } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
}

function ExpandableText({ text, maxLines = 3 }: { text: string; maxLines?: number }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 200; // rough heuristic

  return (
    <div className="space-y-1">
      <p
        className={`text-sm text-muted-foreground leading-relaxed ${!expanded && isLong ? 'line-clamp-3' : ''}`}
      >
        {text}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary font-medium hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function ExpandableList({ items }: { items: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const showToggle = items.length > 3;
  const visibleItems = expanded ? items : items.slice(0, 3);

  return (
    <div className="space-y-1">
      <ul className="space-y-1">
        {visibleItems.map((quote, i) => (
          <li key={i} className="text-sm text-foreground">
            • "{quote}"
          </li>
        ))}
      </ul>
      {showToggle && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary font-medium hover:underline mt-1"
        >
          {expanded ? "Show less" : `Show ${items.length - 3} more`}
        </button>
      )}
    </div>
  );
}

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
}: SkillPortfolioCardProps) {
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);
  const isUnassessed = effectiveLevel === null;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Skill header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-3">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={isUnassessed ? null : skill.ai_confidence} />
            </div>
          </div>
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {/* Unassessed Note */}
        {isUnassessed && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-neutral-50 border border-neutral-200 rounded p-3">
            <AlertCircle className="h-4 w-4 text-neutral-400 mt-0.5 shrink-0" />
            <p>This skill was configured for assessment but never evaluated by the AI (likely due to time constraints). It has been excluded from scoring.</p>
          </div>
        )}

        {/* Low confidence note */}
        {!isUnassessed && skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Only briefly explored. Confidence is low — warrants a dedicated session if this skill matters.
          </div>
        )}

        {/* Evidence */}
        {skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Evidence from interview
            </span>
            <ExpandableList items={skill.evidence} />
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Competency summary
            </span>
            <ExpandableText text={skill.competency_summary} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
