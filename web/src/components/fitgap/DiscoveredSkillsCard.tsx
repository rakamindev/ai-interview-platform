import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import LevelBadge from "@/components/portfolio/LevelBadge";
import { Zap } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill } from "@/types";

interface DiscoveredSkillsCardProps {
  skills: PortfolioSkill[];
}

export default function DiscoveredSkillsCard({ skills }: DiscoveredSkillsCardProps) {
  const discovered = skills.filter((s) => s.is_discovered);
  if (discovered.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-amber-500" />
          Discovered Skills
        </CardTitle>
        <CardDescription className="text-xs">
          Skills demonstrated during dialogue that were outside the original role specification.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {discovered.map((s) => (
          <div
            key={s.id}
            className="p-3 rounded border flex items-center justify-between text-sm"
          >
            <div>
              <span className="font-medium">{s.skill_label}</span>
              {s.competency_summary && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {s.competency_summary}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <LevelBadge level={parseLevel(s.ai_level)} size="sm" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
