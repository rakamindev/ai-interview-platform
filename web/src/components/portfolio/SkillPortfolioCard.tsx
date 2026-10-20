import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Sparkles, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { levelLabel } from "@/utils/constants";
import LevelBadge from "./LevelBadge";
import LevelTrack from "./LevelTrack";
import ConfidenceIndicator from "./ConfidenceIndicator";
import ExpandableText from "./ExpandableText";
import OverridePanel from "./OverridePanel";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  onOverrideSaved: (override: AssessorOverride) => void;
}

export default function SkillPortfolioCard({ skill, onOverrideSaved }: SkillPortfolioCardProps) {
  const [editing, setEditing] = useState(false);
  const override = skill.override;
  const ratedByAssessor = !skill.assessed && !!override;

  return (
    <Card className={cn(!skill.assessed && !override && "border-dashed border-unassessed bg-transparent shadow-none")}>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <LevelBadge level={skill.effective_level} />

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="break-words font-semibold leading-snug">{skill.skill_label}</h3>
              {skill.is_discovered && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Sparkles aria-hidden className="h-3 w-3" /> Discovered in interview
                </span>
              )}
            </div>
            <LevelTrack level={skill.effective_level} />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {skill.assessed ? (
                <ConfidenceIndicator confidence={skill.ai_confidence} />
              ) : (
                <span className="text-xs text-muted-foreground">No evidence in the interview</span>
              )}
              {override && (
                <span className="inline-flex items-center gap-1 text-xs text-foreground">
                  <UserCheck aria-hidden className="h-3.5 w-3.5 text-evidence" />
                  {ratedByAssessor
                    ? `Rated ${levelLabel(override.override_level)} by assessor`
                    : `Assessor changed ${levelLabel(override.ai_level)} to ${levelLabel(override.override_level)}`}
                </span>
              )}
            </div>
          </div>

          {!editing && (
            <Button
              variant={skill.assessed || override ? "ghost" : "outline"}
              size="sm"
              className="basis-full justify-start sm:basis-auto sm:justify-center"
              onClick={() => setEditing(true)}
              aria-label={`${override ? "Edit rating" : skill.assessed ? "Adjust rating" : "Rate manually"} for ${skill.skill_label}`}
            >
              <Pencil aria-hidden className="mr-1.5 h-3.5 w-3.5" />
              {override ? "Edit rating" : skill.assessed ? "Adjust rating" : "Rate manually"}
            </Button>
          )}
        </div>

        {editing && (
          <OverridePanel
            skill={skill}
            onCancel={() => setEditing(false)}
            onSaved={(saved) => {
              setEditing(false);
              onOverrideSaved(saved);
            }}
          />
        )}

        {skill.assessed && skill.ai_confidence === "low" && !override && (
          <p className="rounded-md border border-attention-border bg-attention-surface px-3 py-2 text-xs text-attention">
            Only briefly explored, so this rating is a weak signal. Confirm it with your own rating or a follow-up
            session before relying on it.
          </p>
        )}

        {skill.competency_summary && (
          <ExpandableText text={skill.competency_summary} className="text-sm leading-relaxed text-muted-foreground" />
        )}

        {skill.evidence.length > 0 && (
          <figure className="space-y-2">
            <figcaption className="text-xs font-medium text-muted-foreground">What the candidate said</figcaption>
            {skill.evidence.map((quote, i) => (
              <blockquote key={i} className="border-l-2 border-evidence/60 pl-3 text-sm leading-relaxed">
                <ExpandableText text={quote} maxChars={240} />
              </blockquote>
            ))}
          </figure>
        )}

        {override?.assessor_notes && (
          <div className="space-y-1 rounded-md bg-muted/50 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">Assessor's reason</p>
            <p className="whitespace-pre-line break-words text-sm">{override.assessor_notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
