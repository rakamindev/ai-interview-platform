import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { LEVEL_LABELS } from "@/utils/constants";
import { Pencil, Zap } from "lucide-react";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
}

const STATUS_BOX: Record<string, { label: string; className: string }> = {
  not_assessed: { label: "Not assessed", className: "bg-neutral-100 text-neutral-600" },
  needs_review: { label: "Needs review", className: "bg-amber-100 text-amber-800" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function SkillPortfolioCard({ skill, override, onOverrideSaved }: SkillPortfolioCardProps) {
  const [editing, setEditing] = useState(false);
  const assessed = skill.assessment_status === "assessed";
  const status = STATUS_BOX[skill.assessment_status];
  const effectiveLevel = override?.override_level ?? skill.ai_level;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          {effectiveLevel != null ? (
            <LevelBadge level={effectiveLevel} />
          ) : (
            <div className={`shrink-0 w-16 rounded px-1 py-2 text-center text-[11px] font-semibold leading-tight ${status.className}`}>
              {status.label}
            </div>
          )}

          {/* min width: on narrow screens the button wraps below instead of squeezing the title */}
          <div className="flex-1 min-w-[10rem] space-y-0.5">
            <div className="flex flex-wrap items-center gap-x-1.5">
              <span className="font-semibold break-words">{skill.skill_label}</span>
              {skill.is_discovered && (
                <span className="flex items-center gap-0.5 text-xs text-amber-600">
                  <Zap className="h-3 w-3" /> Discovered
                </span>
              )}
            </div>
            {skill.ai_confidence && <ConfidenceIndicator confidence={skill.ai_confidence} />}
            {!assessed && (
              <p className="text-xs text-muted-foreground">
                {override && status && <span className="font-medium">{status.label}. </span>}
                {skill.status_reason}
              </p>
            )}
          </div>

          {!editing && (
            <Button variant={override ? "ghost" : "outline"} size="sm" className="shrink-0 sm:ml-auto" onClick={() => setEditing(true)}>
              {override ? <><Pencil className="h-3 w-3 mr-1" /> Edit override</> : "Override rating"}
            </Button>
          )}
        </div>

        {assessed && skill.ai_confidence === "low" && (
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Briefly explored. Treat this rating as provisional.
          </p>
        )}

        {override && (
          <div className="text-xs border-l-2 border-primary/60 pl-3 space-y-1">
            <p className="text-muted-foreground">
              <span className="text-primary font-medium">Set by assessor</span>
              {override.overridden_at && ` · ${formatDate(override.overridden_at)}`}
              {" · "}
              {override.ai_level == null ? "AI had not rated this skill" : `replaced AI rating ${LEVEL_LABELS[override.ai_level]}`}
            </p>
            {override.assessor_notes && <p className="text-sm break-words">“{override.assessor_notes}”</p>}
          </div>
        )}

        {skill.evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Evidence from interview</span>
            <ul className="space-y-1.5">
              {skill.evidence.map((quote) => (
                <li key={quote} className="text-sm break-words border-l-2 pl-3">“{quote}”</li>
              ))}
            </ul>
          </div>
        )}

        {skill.assessment_status !== "not_assessed" && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Competency summary</span>
            <p className="text-sm text-muted-foreground leading-relaxed break-words">
              {skill.competency_summary || "No summary provided."}
            </p>
          </div>
        )}

        {editing && (
          <OverridePanel
            skill={skill}
            existingOverride={override}
            onCancel={() => setEditing(false)}
            onSaved={(o) => {
              setEditing(false);
              onOverrideSaved(o);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
