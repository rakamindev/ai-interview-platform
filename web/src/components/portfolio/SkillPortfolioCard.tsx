import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, Microscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

const COVERAGE_STATE_LABELS: Record<string, string> = {
  covered: "covered",
  partial: "partially explored",
  initiated: "briefly explored",
  not_yet: "not explored",
};

const COVERAGE_STATE_CLASSES: Record<string, string> = {
  covered: "text-green-700 bg-green-50",
  partial: "text-amber-700 bg-amber-50",
  initiated: "text-muted-foreground bg-muted",
  not_yet: "text-destructive bg-destructive/10",
};

function CoverageStrengthChip({
  probes,
  state,
}: {
  probes: number;
  state?: string;
}) {
  const label = COVERAGE_STATE_LABELS[state ?? "not_yet"] ?? "unknown";
  const classes = COVERAGE_STATE_CLASSES[state ?? "not_yet"] ?? "";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded",
        classes
      )}
    >
      <Microscope className="h-3 w-3" />
      {probes} probe{probes !== 1 ? "s" : ""} · {label}
    </span>
  );
}

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
  onQuoteClick?: (turnNumber: number) => void;
}

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
  onQuoteClick,
}: SkillPortfolioCardProps) {
  const effectiveLevel = override?.override_level ?? parseLevel(skill.ai_level);

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
              <div className="flex items-center gap-2 flex-wrap">
                <ConfidenceIndicator confidence={skill.ai_confidence} />
                {skill.probe_count != null && (
                  <CoverageStrengthChip
                    probes={skill.probe_count}
                    state={skill.coverage_state}
                  />
                )}
              </div>
            </div>
          </div>
          <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
        </div>

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
              {skill.evidence.map((item, i) => {
                const text = typeof item === "string" ? item : item.text;
                const turnNum =
                  typeof item === "object" ? item.turn_number : null;
                const clickable = turnNum != null && onQuoteClick;
                return (
                  <li key={i} className="text-sm text-foreground flex items-start gap-1.5">
                    <span className="text-muted-foreground select-none">•</span>
                    <div className="flex-1">
                      {turnNum != null && (
                        <span className="inline-block bg-muted text-muted-foreground text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded mr-1.5 border">
                          Turn #{turnNum}
                        </span>
                      )}
                      {clickable ? (
                        <button
                          type="button"
                          onClick={() => onQuoteClick!(turnNum!)}
                          className="text-primary hover:underline cursor-pointer text-left inline font-normal italic"
                        >
                          "{text}"
                        </button>
                      ) : (
                        <span className="italic text-foreground/90">"{text}"</span>
                      )}
                    </div>
                  </li>
                );
              })}
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
