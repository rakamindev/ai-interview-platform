import { Link } from "react-router-dom";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import SkillLevelChart from "@/components/portfolio/SkillLevelChart";
import SkillRadarChart from "@/components/portfolio/SkillRadarChart";
import { Separator } from "@/components/ui/separator";
import { VERDICT_BADGE_CLASSES, VERDICT_LABELS } from "@/utils/verdictBadge";
import { ClipboardX, FileText, MessageSquareText, Zap } from "lucide-react";
import type { AssessorOverride, Portfolio } from "@/types";

interface PortfolioPanelProps {
  portfolio: Portfolio;
  overrides: Record<number, AssessorOverride>;
  transcriptHref: string;
  onOverrideSaved?: (skillId: number, override: AssessorOverride) => void;
  readOnly?: boolean;
}

export default function PortfolioPanel({
  portfolio,
  overrides,
  transcriptHref,
  onOverrideSaved,
  readOnly = false,
}: PortfolioPanelProps) {
  if (portfolio.skills.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center space-y-3">
        <ClipboardX className="h-8 w-8 text-muted-foreground mx-auto" />
        <div className="space-y-1">
          <p className="text-sm font-medium">No skills were assessed</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            This interview didn't produce enough signal to rate any skill — it may have ended early
            or hit an error before the AI could probe the candidate. Check the transcript to see
            what happened.
          </p>
        </div>
        <Link
          to={transcriptHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <FileText className="h-3.5 w-3.5" /> View transcript
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {portfolio.verdict && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
          <MessageSquareText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-primary/80">Verdict</p>
              <span
                className={`text-xs font-semibold rounded-full px-2 py-0.5 ${VERDICT_BADGE_CLASSES[portfolio.verdict]}`}
              >
                {VERDICT_LABELS[portfolio.verdict]}
              </span>
            </div>
            {portfolio.verdict_summary && (
              <p className="text-sm text-foreground/90 leading-relaxed">{portfolio.verdict_summary}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 items-stretch">
        <SkillLevelChart skills={portfolio.skills} overrides={overrides} />
        <SkillRadarChart skills={portfolio.skills} overrides={overrides} />
      </div>

      {/* Configured skills */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Configured Skills
        </h2>
        <div className="space-y-4">
          {portfolio.skills
            .filter((s) => !s.is_discovered)
            .map((skill) => (
              <SkillPortfolioCard
                key={skill.id}
                skill={skill}
                override={overrides[skill.id]}
                readOnly={readOnly}
                onOverrideSaved={onOverrideSaved ? (o) => onOverrideSaved(skill.id, o) : undefined}
              />
            ))}
        </div>
      </div>

      {/* Discovered skills */}
      {portfolio.skills.some((s) => s.is_discovered) && (
        <>
          <Separator />
          <div className="space-y-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Discovered Skills
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Skills the AI probed that were not in the original assessment
              </p>
            </div>
            <div className="space-y-4">
              {portfolio.skills
                .filter((s) => s.is_discovered)
                .map((skill) => (
                  <SkillPortfolioCard
                    key={skill.id}
                    skill={skill}
                    override={overrides[skill.id]}
                    readOnly={readOnly}
                    onOverrideSaved={onOverrideSaved ? (o) => onOverrideSaved(skill.id, o) : undefined}
                  />
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
