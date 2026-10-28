import { CircleHelp, ShieldAlert, UserCheck } from "lucide-react";
import { CoverageBar } from "@/components/ui/coverage-bar";
import { StatCard } from "@/components/ui/stat-card";
import type { PortfolioSkill } from "@/types";

// Counts read from the presenter fields (effective_level, level_source);
// no level is recomputed here.
export default function PortfolioSummary({ skills }: { skills: PortfolioSkill[] }) {
  const configured = skills.filter((skill) => !skill.is_discovered);
  const withLevel = configured.filter((skill) => skill.effective_level != null).length;
  const lowUnreviewed = configured.filter((skill) => skill.ai_confidence === "low" && skill.level_source === "ai").length;
  const reviewed = configured.filter((skill) =>
    skill.level_source === "assessor_override" || skill.level_source === "assessor_confirmed").length;

  return (
    <section aria-label="Summary" className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Not assessed" value={configured.length - withLevel} icon={CircleHelp} tone="muted" />
        <StatCard label="Low confidence" value={lowUnreviewed} icon={ShieldAlert} tone="muted" />
        <StatCard label="Assessor reviewed" value={reviewed} icon={UserCheck} />
      </div>
      <div className="space-y-2 rounded-lg border bg-card p-4">
        <CoverageBar value={withLevel} total={configured.length} label="configured skills have a level" />
        <p className="text-sm text-muted-foreground">
          Skills without a level or with low confidence are not counted toward fit. Review them below or ask about
          them in the next interview.
        </p>
      </div>
    </section>
  );
}
