import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverrideForm from "./OverrideForm";
import OverrideHistory from "./OverrideHistory";
import { Pencil, Zap } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride, OverrideEvent } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride, event: OverrideEvent) => void;
}

export default function SkillPortfolioCard({ skill, override, onOverrideSaved }: SkillPortfolioCardProps) {
  const [editing, setEditing] = useState(false);
  const aiLevel = parseLevel(skill.ai_level);
  const effectiveLevel = override?.override_level ?? aiLevel;
  const corrected = !!override && override.override_level !== aiLevel;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Header: level efektif + asal level + tombol koreksi */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <LevelBadge level={effectiveLevel} />
            <div className="space-y-0.5 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold break-words">{skill.skill_label}</span>
                {skill.is_discovered && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600">
                    <Zap className="h-3 w-3" /> Discovered
                  </span>
                )}
              </div>
              <ConfidenceIndicator confidence={skill.ai_confidence} />
              {corrected && (
                <p className="text-xs text-muted-foreground">
                  Corrected by assessor · AI rated {`L${aiLevel}`}
                </p>
              )}
            </div>
          </div>

          {!editing && (
            <Button variant="outline" size="sm" className="self-start shrink-0" onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3 mr-1.5" aria-hidden />
              {override ? "Correct again" : "Correct rating"}
            </Button>
          )}
        </div>

        {editing && (
          <OverrideForm
            skill={skill}
            currentLevel={effectiveLevel}
            onCancel={() => setEditing(false)}
            onSaved={(o, e) => {
              onOverrideSaved(o, e);
              setEditing(false);
            }}
          />
        )}

        {/* Low confidence note */}
        {skill.ai_confidence?.toLowerCase() === "low" && (
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
                <li key={i} className="text-sm text-foreground break-words">
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
            <p className="text-sm text-muted-foreground leading-relaxed break-words">{skill.competency_summary}</p>
          </div>
        )}

        {/* Riwayat koreksi (F-05) */}
        <div className="border-t pt-3">
          <OverrideHistory events={skill.override_history ?? []} />
        </div>
      </CardContent>
    </Card>
  );
}
