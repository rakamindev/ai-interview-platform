import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillRadarChartProps {
  skills: PortfolioSkill[];
  overrides: Record<number, AssessorOverride>;
}

// Wider than tall: side labels (e.g. "React & Hooks") need more horizontal
// room than top/bottom labels do, or they clip against the viewBox edge.
const WIDTH = 380;
const HEIGHT = 300;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const MAX_RADIUS = HEIGHT / 2 - 60; // leave room for axis labels
const MAX_LEVEL = 5;
const AXIS_COLOR = "#184f95"; // step 600, same ramp as the bar chart

function parseLevel(aiLevel: string | number | null | undefined): number {
  if (aiLevel === null || aiLevel === undefined) return 0;
  const n = typeof aiLevel === "number" ? aiLevel : Number(aiLevel.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 0;
}

function pointOn(angle: number, radius: number) {
  // angle 0 = straight up, clockwise
  const rad = (angle - 90) * (Math.PI / 180);
  return { x: CENTER_X + radius * Math.cos(rad), y: CENTER_Y + radius * Math.sin(rad) };
}

export default function SkillRadarChart({ skills, overrides }: SkillRadarChartProps) {
  const rows = skills
    .map((skill) => {
      const override = overrides[skill.id];
      const level = override ? override.override_level : parseLevel(skill.ai_level);
      return { id: skill.id, label: skill.skill_label, level };
    })
    .filter((row) => row.level > 0);

  if (rows.length < 3) {
    return (
      <div className="rounded-2xl border shadow-sm p-5 bg-card h-full flex flex-col">
        <div className="mb-1">
          <h2 className="text-sm font-bold">Skill Profile</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Same levels, shaped as a candidate profile</p>
        </div>
        <div className="flex-1 flex items-center justify-center text-center py-10 px-4">
          <p className="text-xs text-muted-foreground max-w-[220px]">
            Needs at least 3 assessed skills to draw a profile shape.
            {rows.length > 0 && ` Only ${rows.length} assessed so far.`}
          </p>
        </div>
      </div>
    );
  }

  const n = rows.length;
  const angleStep = 360 / n;

  // Gridlines: one ring per level 1..5
  const rings = [1, 2, 3, 4, 5].map((level) => {
    const r = (level / MAX_LEVEL) * MAX_RADIUS;
    const points = rows.map((_, i) => pointOn(i * angleStep, r));
    return { level, path: points.map((p) => `${p.x},${p.y}`).join(" ") };
  });

  // Data polygon
  const dataPoints = rows.map((row, i) => pointOn(i * angleStep, (row.level / MAX_LEVEL) * MAX_RADIUS));
  const dataPath = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Axis lines + labels
  const axes = rows.map((row, i) => {
    const end = pointOn(i * angleStep, MAX_RADIUS);
    const labelPos = pointOn(i * angleStep, MAX_RADIUS + 14);
    const angle = i * angleStep;
    const anchor: "middle" | "start" | "end" =
      angle === 0 || angle === 180 ? "middle" : angle < 180 ? "start" : "end";
    return { ...row, end, labelPos, anchor };
  });

  return (
    <div className="rounded-2xl border shadow-sm p-5 bg-card h-full flex flex-col">
      <div className="mb-1">
        <h2 className="text-sm font-bold">Skill Profile</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Same levels, shaped as a candidate profile</p>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <svg
          width="100%"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Skill profile radar chart: ${rows.map((r) => `${r.label} at level ${r.level}`).join(", ")}`}
          className="max-w-sm"
        >
          {/* Gridline rings */}
          {rings.map((ring) => (
            <polygon
              key={ring.level}
              points={ring.path}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth={1}
            />
          ))}

          {/* Axis spokes */}
          {axes.map((axis) => (
            <line
              key={`spoke-${axis.id}`}
              x1={CENTER_X}
              y1={CENTER_Y}
              x2={axis.end.x}
              y2={axis.end.y}
              stroke="hsl(var(--border))"
              strokeWidth={1}
            />
          ))}

          {/* Data area */}
          <polygon points={dataPath} fill={AXIS_COLOR} fillOpacity={0.18} stroke={AXIS_COLOR} strokeWidth={2} />

          {/* Data points */}
          {dataPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4} fill={AXIS_COLOR} stroke="white" strokeWidth={1.5} />
          ))}

          {/* Axis labels */}
          {axes.map((axis) => (
            <text
              key={`label-${axis.id}`}
              x={axis.labelPos.x}
              y={axis.labelPos.y}
              textAnchor={axis.anchor}
              dominantBaseline="middle"
              fontSize={9.5}
              fill="hsl(var(--muted-foreground))"
            >
              {axis.label.length > 14 ? `${axis.label.slice(0, 13)}…` : axis.label}
            </text>
          ))}
        </svg>
      </div>

      {/* Accessible data table alternative */}
      <table className="sr-only">
        <caption>Skill profile levels, 1 to 5</caption>
        <thead>
          <tr><th>Skill</th><th>Level</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}><td>{row.label}</td><td>L{row.level}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
