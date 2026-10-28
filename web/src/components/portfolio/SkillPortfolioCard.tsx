import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import EvidenceList from "./EvidenceList";
import ExpandableText from "./ExpandableText";
import OverridePanel, { OverrideSummary, OverrideTrigger } from "./OverridePanel";
import { confidenceReason, effectiveLevel, isAssessed, needsReview, notAssessedCopy } from "@/lib/portfolio";
import { cn } from "@/lib/utils";
import { CircleDashed, Eye, Zap } from "lucide-react";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
  transcriptPath: string;
}

export default function SkillPortfolioCard({ skill, override, onOverrideSaved, transcriptPath }: SkillPortfolioCardProps) {
  const [editing, setEditing] = useState(false);
  const assessed = isAssessed(skill);
  const level = effectiveLevel(skill, override);
  const review = needsReview(skill, override);
  const copy = notAssessedCopy(skill.status_reason);

  return (
    <Card
      className={cn(
        "shadow-sm transition-colors",
        !assessed && !override && "border-dashed bg-muted/20 shadow-none"
      )}
      data-testid={`skill-card-${skill.id}`}
    >
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <LevelBadge level={level} />
            <div className="min-w-0 space-y-1">
              <h3 className="font-semibold leading-snug break-words">{skill.skill_label}</h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {assessed && <ConfidenceIndicator confidence={skill.ai_confidence} reason={confidenceReason(skill)} />}
                {!assessed && !override && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <CircleDashed className="h-3.5 w-3.5" aria-hidden />
                    {copy.title}
                  </span>
                )}
                {skill.is_discovered && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                    <Zap className="h-3 w-3" aria-hidden /> Discovered
                  </span>
                )}
                {review && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    <Eye className="h-3 w-3" aria-hidden /> Needs your review
                  </span>
                )}
              </div>
            </div>
          </div>
          {!editing && (
            <OverrideTrigger skill={skill} existingOverride={override} open={editing} onToggle={() => setEditing(true)} />
          )}
        </div>

        {editing && (
          <OverridePanel
            skill={skill}
            existingOverride={override}
            onCancel={() => setEditing(false)}
            onSaved={(o) => {
              onOverrideSaved(o);
              setEditing(false);
            }}
          />
        )}

        {override && !editing && <OverrideSummary skill={skill} override={override} />}

        {assessed ? (
          <>
            <EvidenceList
              evidence={skill.evidence}
              refs={skill.evidence_refs}
              unverifiedCount={skill.unverified_evidence_count}
              transcriptPath={transcriptPath}
            />
            <div className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI summary</span>
              <ExpandableText text={skill.competency_summary} className="text-sm leading-relaxed text-muted-foreground" />
            </div>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
        )}
      </CardContent>
    </Card>
  );
}
