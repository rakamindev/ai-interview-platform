import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import AssessmentStateBadge from "./AssessmentStateBadge";
import CoverageMeter from "./CoverageMeter";
import OverridePanel from "./OverridePanel";
import { Zap } from "lucide-react";
import { LEVEL_LABELS } from "@/utils/constants";
import type { SkillView } from "@/types";

const SUMMARY_CLAMP = 240;

interface SkillPortfolioCardProps {
  skill: SkillView;
  onOverrideSaved: () => void;
}

export default function SkillPortfolioCard({ skill, onOverrideSaved }: SkillPortfolioCardProps) {
  const [expanded, setExpanded] = useState(false);
  const notAssessed = skill.state === "not_assessed";
  const summary = skill.competency_summary ?? "";
  const longSummary = summary.length > SUMMARY_CLAMP;
  const canOverride = skill.portfolio_skill_id != null && !notAssessed;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          {notAssessed ? (
            <div className="inline-flex min-w-14 items-center justify-center rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-400">
              —
            </div>
          ) : (
            skill.effective_level != null && <LevelBadge level={skill.effective_level} />
          )}

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="break-words font-semibold">{skill.skill_label}</span>
              <AssessmentStateBadge state={skill.state} />
              {skill.is_discovered && (
                <span className="flex items-center gap-0.5 text-xs text-amber-600">
                  <Zap className="h-3 w-3" /> Discovered
                </span>
              )}
            </div>

            {notAssessed ? (
              <p className="text-xs text-muted-foreground">
                Not rated — insufficient evidence
                {skill.expected_level ? ` (expected ${LEVEL_LABELS[skill.expected_level]})` : ""}.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {skill.ai_confidence && <ConfidenceIndicator confidence={skill.ai_confidence} />}
                <CoverageMeter state={skill.coverage_state} probeCount={skill.probe_count} />
              </div>
            )}
          </div>
        </div>

        {/* Override audit line */}
        {skill.override && (
          <div className="border-l-2 border-green-400 pl-2 text-xs text-muted-foreground">
            Adjusted to <span className="font-medium">{LEVEL_LABELS[skill.override.level]}</span> by assessor
            {skill.override.at ? ` on ${new Date(skill.override.at).toLocaleDateString()}` : ""}.
            {" "}Reason: {skill.override.reason}
          </div>
        )}

        {/* Evidence */}
        {!notAssessed && skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Evidence from interview
            </span>
            <ul className="space-y-1">
              {skill.evidence.map((quote) => (
                <li key={quote} className="break-words text-sm">• “{quote}”</li>
              ))}
            </ul>
          </div>
        )}

        {/* Competency summary */}
        {!notAssessed && (
          <div className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Competency summary
            </span>
            {summary ? (
              <p className="break-words text-sm leading-relaxed text-muted-foreground">
                {longSummary && !expanded ? `${summary.slice(0, SUMMARY_CLAMP)}…` : summary}
                {longSummary && (
                  <button
                    className="ml-1 text-xs text-primary hover:underline"
                    onClick={() => setExpanded((e) => !e)}
                  >
                    {expanded ? "Show less" : "Show more"}
                  </button>
                )}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground">Summary unavailable.</p>
            )}
          </div>
        )}

        {/* Override control */}
        {canOverride && (
          <OverridePanel skill={skill} onSaved={onOverrideSaved} />
        )}
      </CardContent>
    </Card>
  );
}
