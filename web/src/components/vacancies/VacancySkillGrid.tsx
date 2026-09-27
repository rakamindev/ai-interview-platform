
import type { Vacancy } from "@/types";

interface VacancySkillGridProps {
  skills?: Vacancy["skills"];
  compact?: boolean;
}

export default function VacancySkillGrid({
  skills,
  compact = false,
}: VacancySkillGridProps) {
  if (!Array.isArray(skills)) {
    return (
      <span className="text-xs text-slate-400">
        Skills unavailable
      </span>
    );
  }

  const skillNames = skills
    .map((skill) => ({
      id: skill.id,
      name: skill.skill_label?.trim() ?? "",
    }))
    .filter((skill) => skill.name.length > 0);

  if (skillNames.length === 0) {
    return (
      <span className="text-xs text-slate-400">
        No skills configured
      </span>
    );
  }

  return (
    <div
      className={
        compact
          ? "grid grid-cols-2 gap-2"
          : "grid max-w-2xl grid-cols-2 gap-2 lg:grid-cols-3"
      }
    >
      {skillNames.map((skill, index) => (
        <div
          key={skill.id ?? `${skill.name}-${index}`}
          title={skill.name}
          className="flex min-w-0 items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />

          <span className="min-w-0 break-words text-xs font-medium leading-4 text-slate-700">
            {skill.name}
          </span>
        </div>
      ))}
    </div>
  );
}
