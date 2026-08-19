import { Card, CardContent } from "@/shared/ui/card";
import TruncatedText from "@/shared/ui/truncated-text";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, CircleDashed } from "lucide-react";
import { parseLevel } from "@/shared/constants";
import type { PortfolioSkill, AssessorOverride } from "@/features/portfolio/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
}

function SkillTitle({ skill }: { skill: PortfolioSkill }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-semibold">{skill.skill_label}</span>
      {skill.is_discovered && (
        <span className="flex items-center gap-0.5 text-xs text-amber-600">
          <Zap className="h-3 w-3" /> Discovered
        </span>
      )}
    </div>
  );
}

function NotAssessedCard({ skill }: { skill: PortfolioSkill }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="inline-flex items-center justify-center rounded px-3 py-2 min-w-14 bg-muted text-muted-foreground">
            <CircleDashed className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <SkillTitle skill={skill} />
            <p className="text-xs text-muted-foreground">
              Not assessed — this skill was not covered during the interview.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
}: SkillPortfolioCardProps) {
  if (skill.status === "not_assessed") {
    return <NotAssessedCard skill={skill} />;
  }

  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level ?? 1);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-0.5">
              <SkillTitle skill={skill} />
              <ConfidenceIndicator confidence={skill.ai_confidence ?? ""} />
            </div>
          </div>
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

        {skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Only briefly explored. Confidence is low — warrants a dedicated session if this skill matters.
          </div>
        )}

        {skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Evidence from interview
            </span>
            <ul className="space-y-1">
              {skill.evidence.map((quote, i) => (
                <li key={i} className="text-sm text-foreground">
                  • "<TruncatedText text={quote} maxLength={160} />"
                </li>
              ))}
            </ul>
          </div>
        )}

        {skill.competency_summary && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Competency summary
            </span>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <TruncatedText text={skill.competency_summary} maxLength={220} />
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
