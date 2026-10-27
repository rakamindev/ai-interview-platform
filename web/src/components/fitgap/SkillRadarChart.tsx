import { useState } from "react";
import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface SkillRadarChartProps {
  comparisons: SkillComparison[];
  className?: string;
}

export default function SkillRadarChart({ comparisons, className }: SkillRadarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!comparisons || comparisons.length === 0) return null;

  // If fewer than 3 skills, render sleek horizontal comparative progress bars
  if (comparisons.length < 3) {
    return (
      <div className={cn("p-4 bg-white rounded-xl border space-y-4", className)}>
        <div className="flex items-center justify-between border-b pb-2">
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Comparative Competency Map
          </span>
          <span className="text-[11px] text-muted-foreground">Candidate vs Benchmark</span>
        </div>
        <div className="space-y-4 pt-1">
          {comparisons.map((c, i) => {
            const reqPct = (c.required_level / 5) * 100;
            const candLevel = c.candidate_level ?? 0;
            const candPct = (candLevel / 5) * 100;

            return (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    {c.skill_label} {c.is_override && <span className="text-muted-foreground font-normal">✏</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Req: {LEVEL_LABELS[c.required_level]}</span>
                    <span className="font-bold text-teal-700">
                      Cand: {c.candidate_level ? LEVEL_LABELS[c.candidate_level] : "—"}
                    </span>
                  </div>
                </div>

                <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden flex items-center">
                  {/* Required indicator marker line */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-slate-400 z-10"
                    style={{ left: `${reqPct}%` }}
                    title={`Required: L${c.required_level}`}
                  />
                  {/* Candidate progress fill */}
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      c.result === "exceed" ? "bg-emerald-500" : c.result === "gap" ? "bg-amber-500" : "bg-teal-500"
                    )}
                    style={{ width: `${candPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── 3+ Skills: Pure SVG Radar (Spider) Chart ───────────────────────────────
  const size = 320;
  const center = size / 2;
  const radius = 105;
  const numSkills = comparisons.length;
  const angleStep = (2 * Math.PI) / numSkills;

  // Calculate coordinates for a given index and level (1..5)
  const getCoordinates = (index: number, level: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (level / 5) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Generate polygon points string for a level grid (1..5)
  const getGridPolygon = (level: number) => {
    return Array.from({ length: numSkills })
      .map((_, i) => {
        const { x, y } = getCoordinates(i, level);
        return `${x},${y}`;
      })
      .join(" ");
  };

  // Generate polygon for required benchmarks
  const requiredPolygon = comparisons
    .map((c, i) => {
      const { x, y } = getCoordinates(i, c.required_level);
      return `${x},${y}`;
    })
    .join(" ");

  // Generate polygon for candidate actual scores
  const candidatePolygon = comparisons
    .map((c, i) => {
      const level = c.candidate_level ?? 0;
      const { x, y } = getCoordinates(i, level);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className={cn("bg-white border rounded-xl p-4 sm:p-5 flex flex-col items-center select-none shadow-sm", className)}>
      <div className="w-full flex items-center justify-between border-b pb-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Radar Kompetensi &amp; Fit/Gap Visual
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-teal-500/80 inline-block" />
            <span className="text-slate-700 font-medium">Candidate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-slate-400 inline-block border-t border-dashed" />
            <span className="text-slate-500">Benchmark</span>
          </div>
        </div>
      </div>

      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} className="overflow-visible">
          <defs>
            {/* Candidate Area Gradient */}
            <radialGradient id="candGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#0d9488" stopOpacity="0.25" />
            </radialGradient>
          </defs>

          {/* Concentric Level Grid Rings */}
          {[1, 2, 3, 4, 5].map((lvl) => (
            <polygon
              key={`grid-${lvl}`}
              points={getGridPolygon(lvl)}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={lvl === 5 ? "1.5" : "1"}
              strokeDasharray={lvl === 5 ? undefined : "2 2"}
            />
          ))}

          {/* Level Axis Label */}
          {[1, 2, 3, 4, 5].map((lvl) => {
            const { y } = getCoordinates(0, lvl);
            return (
              <text
                key={`lvl-lbl-${lvl}`}
                x={center + 6}
                y={y + 3}
                fontSize="9"
                fill="#94a3b8"
                fontWeight="500"
              >
                L{lvl}
              </text>
            );
          })}

          {/* Radial Spokes from Center */}
          {comparisons.map((_, i) => {
            const { x, y } = getCoordinates(i, 5);
            return (
              <line
                key={`spoke-${i}`}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="#cbd5e1"
                strokeWidth="1"
              />
            );
          })}

          {/* Required Benchmark Polygon (Dashed Slate) */}
          <polygon
            points={requiredPolygon}
            fill="#64748b"
            fillOpacity="0.08"
            stroke="#64748b"
            strokeWidth="2"
            strokeDasharray="4 3"
          />

          {/* Candidate Polygon (Glowing Teal) */}
          <polygon
            points={candidatePolygon}
            fill="url(#candGrad)"
            stroke="#0d9488"
            strokeWidth="2.5"
            className="transition-all duration-500"
          />

          {/* Vertices & Labels */}
          {comparisons.map((c, i) => {
            const reqCoord = getCoordinates(i, c.required_level);
            const candCoord = getCoordinates(i, c.candidate_level ?? 0);
            const labelCoord = getCoordinates(i, 5.8);
            const isHovered = hoveredIndex === i;

            return (
              <g key={`vertex-${i}`} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} className="cursor-pointer">
                {/* Required Point */}
                <circle
                  cx={reqCoord.x}
                  cy={reqCoord.y}
                  r="3.5"
                  fill="#64748b"
                  stroke="#ffffff"
                  strokeWidth="1"
                />

                {/* Candidate Point */}
                <circle
                  cx={candCoord.x}
                  cy={candCoord.y}
                  r={isHovered ? "6" : "4.5"}
                  fill={c.result === "exceed" ? "#10b981" : c.result === "gap" ? "#f59e0b" : "#0d9488"}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="transition-all duration-200"
                />

                {/* Outer Skill Name Label */}
                <text
                  x={labelCoord.x}
                  y={labelCoord.y}
                  textAnchor={labelCoord.x > center + 10 ? "start" : labelCoord.x < center - 10 ? "end" : "middle"}
                  dominantBaseline="central"
                  fontSize="10"
                  fontWeight={isHovered ? "700" : "500"}
                  fill={isHovered ? "#0f172a" : "#475569"}
                  className="transition-colors"
                >
                  {c.skill_label.length > 18 ? `${c.skill_label.slice(0, 16)}…` : c.skill_label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredIndex !== null && comparisons[hoveredIndex] && (
          <div className="absolute bottom-2 bg-slate-900/95 text-white text-xs px-3 py-1.5 rounded-lg shadow-xl backdrop-blur-sm pointer-events-none border border-slate-700 animate-in fade-in zoom-in-95">
            <p className="font-semibold text-slate-100">{comparisons[hoveredIndex].skill_label}</p>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-300">
              <span>Required: L{comparisons[hoveredIndex].required_level}</span>
              <span>·</span>
              <span className="text-teal-300 font-bold">
                Actual: {comparisons[hoveredIndex].candidate_level ? `L${comparisons[hoveredIndex].candidate_level}` : "Not Assessed"}
              </span>
              <span>·</span>
              <span className="capitalize">{FIT_GAP_RESULT_LABELS[comparisons[hoveredIndex].result]}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
