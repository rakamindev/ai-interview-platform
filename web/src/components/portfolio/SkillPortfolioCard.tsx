import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { LEVEL_LABELS, parseLevel } from "@/utils/constants";
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
  const aiLevel = parseLevel(skill.ai_level);
  const effectiveLevel = override?.override_level ?? aiLevel;

  return (
    <Card className="min-w-0 rounded-2xl border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold leading-snug tracking-tight">{skill.skill_label}</span>
              {skill.is_discovered && (
                <Badge variant="secondary" className="gap-1 bg-secondary/25 text-secondary-foreground">
                  <Zap className="h-3 w-3" />
                  Discovered
                </Badge>
              )}
              {override && (
                <Badge variant="outline" className="border-primary/20 text-primary">Human override</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <ConfidenceIndicator confidence={skill.ai_confidence} />
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                AI assessed
              </span>
            </div>
          </div>
          <div className="shrink-0 self-start sm:pt-0.5">
            <OverridePanel skill={skill} existingOverride={override} onSaved={onOverrideSaved} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-border/70 pt-4">
          <LevelBadge level={effectiveLevel} className="rounded-xl" />
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Rating source</p>
            {override ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-border bg-muted/60 text-muted-foreground">AI {LEVEL_LABELS[aiLevel]}</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">Human {LEVEL_LABELS[effectiveLevel]}</Badge>
              </div>
            ) : (
              <p className="text-sm font-medium text-foreground">AI assessed · {LEVEL_LABELS[effectiveLevel]}</p>
            )}
          </div>
        </div>

        {skill.ai_confidence?.toLowerCase() === "low" && (
          <div className="rounded-xl border border-secondary/50 bg-secondary/10 px-3 py-2.5 text-xs leading-relaxed text-secondary-foreground">
            Only briefly explored. Confidence is low — this skill warrants a dedicated session if it matters for the role.
          </div>
        )}

        {skill.evidence.length > 0 && (
          <div className="space-y-2 rounded-xl bg-muted/45 p-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Evidence from interview
            </span>
            <ul className="space-y-2">
              {skill.evidence.map((quote, i) => (
                <li key={i} className="text-sm leading-relaxed text-foreground">
                  <span className="mr-1 text-primary">“</span>{quote}<span className="text-primary">”</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {skill.competency_summary && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Competency summary
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground">{skill.competency_summary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
