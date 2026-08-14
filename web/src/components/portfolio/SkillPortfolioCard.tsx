import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, MinusCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
}

const UNASSESSED_COPY = {
  not_assessed: {
    icon: MinusCircle,
    label: "Not assessed",
    detail: "This skill was configured for the assessment but wasn't covered during the interview.",
    classes: "border-dashed text-muted-foreground",
    iconClasses: "text-muted-foreground",
  },
  unparseable: {
    icon: AlertTriangle,
    label: "Needs manual review",
    detail: "The assessment model's response for this skill couldn't be scored automatically.",
    classes: "border-amber-300",
    iconClasses: "text-amber-600",
  },
} as const;

/** Rendered for a skill that has no real AI level to show — never crash on a null level, never fake one. */
function UnassessedSkillCard({ skill, status }: { skill: PortfolioSkill; status: "not_assessed" | "unparseable" }) {
  const copy = UNASSESSED_COPY[status];
  const Icon = copy.icon;

  return (
    <Card className={copy.classes} data-testid="unassessed-skill-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", copy.iconClasses)} aria-hidden="true" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold">{skill.skill_label}</span>
              {skill.is_discovered && (
                <span className="flex items-center gap-0.5 text-xs text-amber-600">
                  <Zap className="h-3 w-3" /> Discovered
                </span>
              )}
            </div>
            <span className={cn("text-xs font-medium", copy.iconClasses)}>{copy.label}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {skill.competency_summary || copy.detail}
        </p>
      </CardContent>
    </Card>
  );
}

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
}: SkillPortfolioCardProps) {
  if (skill.status !== "assessed") {
    return <UnassessedSkillCard skill={skill} status={skill.status} />;
  }

  const parsedLevel = parseLevel(skill.ai_level);
  if (parsedLevel === null) {
    // Defensive: backend marked this "assessed" but sent no usable level.
    // Treat it the same as unparseable rather than crash (null.replace in
    // the old parseLevel) or silently render it as L1.
    return <UnassessedSkillCard skill={skill} status="unparseable" />;
  }

  const effectiveLevel = override?.override_level ?? parsedLevel;
  // Narrowed copy: ai_level/ai_confidence are guaranteed non-null here (we
  // just checked status === "assessed" and parsedLevel !== null above), so
  // downstream components that only make sense for an assessed skill
  // (confidence indicator, override panel) get real types instead of
  // `| null` — no `?? 1`-style fallback needed anywhere below.
  const assessedSkill = { ...skill, ai_level: parsedLevel, ai_confidence: skill.ai_confidence ?? "low" };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Skill header */}
        <div className="flex items-start justify-between gap-3">
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
              <ConfidenceIndicator confidence={assessedSkill.ai_confidence} />
            </div>
          </div>
          <OverridePanel skill={assessedSkill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {/* Low confidence note */}
        {assessedSkill.ai_confidence.toLowerCase() === "low" && (
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
            <ul className="space-y-1">
              {skill.evidence.map((quote, i) => (
                <li key={i} className="text-sm text-foreground">
                  • "{quote}"
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Competency summary */}
        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Competency summary
            </span>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {skill.competency_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
