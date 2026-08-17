import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillLevelChartProps {
  skills: PortfolioSkill[];
  overrides: Record<number, AssessorOverride>;
}

// Ordinal sequential ramp (blue, light -> dark), one step per level L1-L5.
// Values come from the design system's sequential ramp, spaced to keep each
// step visually distinct while staying within the ordinal contrast bounds.
const LEVEL_COLOR: Record<number, string> = {
  1: "#86b6ef", // step 250
  2: "#5598e7", // step 350
  3: "#2a78d6", // step 450
  4: "#1c5cab", // step 550
  5: "#184f95", // step 600
};

const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Foundational",
  2: "Functional",
  3: "Proficient",
  4: "Advanced",
  5: "Expert",
};

function parseLevel(aiLevel: string | number | null | undefined): number {
  if (aiLevel === null || aiLevel === undefined) return 0;
  const n = typeof aiLevel === "number" ? aiLevel : Number(aiLevel.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 0;
}

export default function SkillLevelChart({ skills, overrides }: SkillLevelChartProps) {
  const rows = skills
    .map((skill) => {
      const override = overrides[skill.id];
      const level = override ? override.override_level : parseLevel(skill.ai_level);
      return { id: skill.id, label: skill.skill_label, level, overridden: !!override };
    })
    .filter((row) => row.level > 0);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border shadow-sm p-5 space-y-4 bg-card h-full flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">Skill Levels</h2>
          <p className="text-xs text-muted-foreground mt-0.5">At-a-glance spread across all assessed skills</p>
        </div>

        {/* Scale legend: same color ramp used by every bar below, 1 (light) to 5 (dark) */}
        <div className="shrink-0 text-right hidden sm:block">
          <div className="flex h-1.5 w-24 rounded-full overflow-hidden ring-1 ring-border" role="presentation">
            {[1, 2, 3, 4, 5].map((level) => (
              <div key={level} className="flex-1" style={{ backgroundColor: LEVEL_COLOR[level] }} />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1 w-24">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>Skill levels, 1 to 5, per assessed skill</caption>
        <thead>
          <tr>
            <th>Skill</th>
            <th>Level</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.label}</td>
              <td>L{row.level}{row.overridden ? " (assessor override)" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-3 flex-1 flex flex-col justify-center" aria-hidden="true">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-3">
            <div className="w-40 shrink-0 text-xs font-medium text-foreground/80 truncate" title={row.label}>
              {row.label}
            </div>
            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(row.level / 5) * 100}%`,
                  backgroundColor: LEVEL_COLOR[row.level],
                }}
              />
            </div>
            <div className="w-16 shrink-0 text-right tabular-nums">
              <span className="text-xs font-semibold">
                L{row.level}
                {row.overridden && <span className="text-muted-foreground font-normal"> *</span>}
              </span>
              <span className="block text-[10px] text-muted-foreground leading-tight">
                {LEVEL_DESCRIPTIONS[row.level]}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground pt-1 border-t">* assessor override applied</p>
    </div>
  );
}
