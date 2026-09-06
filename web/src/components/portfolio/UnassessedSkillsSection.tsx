import SkillPortfolioCard from "./SkillPortfolioCard";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface UnassessedSkillsSectionProps {
  skills: PortfolioSkill[];
  overrides: Record<number, AssessorOverride>;
  onOverrideSaved: (skillId: number, override: AssessorOverride) => void;
}

export default function UnassessedSkillsSection({
  skills,
  overrides,
  onOverrideSaved,
}: UnassessedSkillsSectionProps) {
  if (skills.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="border border-dashed rounded-lg p-4 bg-muted/20 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Configured Skills Not Probed During Session
        </p>
        <div className="space-y-2">
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
    </div>
  );
}
