import { Separator } from "@/components/ui/separator";
import SkillPortfolioCard from "./SkillPortfolioCard";
import { Zap } from "lucide-react";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface DiscoveredSkillsSectionProps {
  skills: PortfolioSkill[];
  overrides: Record<number, AssessorOverride>;
  onOverrideSaved: (skillId: number, override: AssessorOverride) => void;
}

export default function DiscoveredSkillsSection({
  skills,
  overrides,
  onOverrideSaved,
}: DiscoveredSkillsSectionProps) {
  if (skills.length === 0) return null;

  return (
    <>
      <Separator />
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-500" />
            Discovered Skills
          </h2>
          <p className="text-xs text-muted-foreground">
            Additional competencies identified by the AI that were not in the original assessment template.
          </p>
        </div>
        <div className="space-y-3">
          {skills.map((skill) => (
            <SkillPortfolioCard
              key={skill.id}
              skill={skill}
              override={overrides[skill.id]}
              onOverrideSaved={(o) => onOverrideSaved(skill.id, o)}
            />
          ))}
        </div>
      </div>
    </>
  );
}
