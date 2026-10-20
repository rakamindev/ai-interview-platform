import { Card, CardContent } from "@/components/ui/card";
import LevelBadge from "./LevelBadge";
import ConfidenceIndicator from "./ConfidenceIndicator";
import OverridePanel from "./OverridePanel";
import { Zap, UserCheck, Quote } from "lucide-react";
import { parseLevel, LEVEL_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface SkillPortfolioCardProps {
  skill: PortfolioSkill;
  override?: AssessorOverride;
  onOverrideSaved: (override: AssessorOverride) => void;
}

function formatTimestamp(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SkillPortfolioCard({
  skill,
  override,
  onOverrideSaved,
}: SkillPortfolioCardProps) {
  const aiLevelNum = parseLevel(skill.ai_level);
  const effectiveLevel = override?.override_level ?? aiLevelNum;
  const formattedOverrideTime = formatTimestamp(override?.overridden_at);

  return (
    <Card
      className={cn(
        "transition-colors",
        override ? "border-[#0F8F95]/40" : "border-[#E2E8F0]"
      )}
    >
      <CardContent className="p-4 sm:p-5 space-y-3.5">
        {/* 1. Heading row: Skill name aligned with effective rating */}
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[16px] font-semibold leading-snug text-[#1F2937] break-words">
              {skill.skill_label}
            </h3>
            <LevelBadge level={effectiveLevel} />
          </div>

          {/* 2. Supporting metadata beneath heading */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
            {skill.coverage_state === "covered" && (
              <span className="inline-flex items-center font-medium text-[#0B7479] bg-[#0F8F95]/10 border border-[#0F8F95]/20 px-2 py-0.5 rounded-md">
                Covered
                {skill.probe_count != null ? ` (${skill.probe_count} probes)` : ""}
              </span>
            )}
            {skill.coverage_state === "partial" && (
              <span className="inline-flex items-center font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                Partially assessed
                {skill.probe_count != null ? ` (${skill.probe_count} probes)` : ""}
              </span>
            )}
            {skill.is_discovered && (
              <span className="inline-flex items-center gap-1 font-medium text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                <Zap className="h-3 w-3 text-amber-600" aria-hidden="true" /> Discovered
              </span>
            )}
            <ConfidenceIndicator confidence={skill.ai_confidence} />
            <span className="text-[#CBD5E1]" aria-hidden="true">·</span>
            {override ? (
              <span className="inline-flex items-center gap-1 font-medium text-[#0B7479]">
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Human override active
              </span>
            ) : (
              <span>AI-generated rating</span>
            )}
          </div>
        </div>

        {/* 3. Scannable Competency Summary */}
        {skill.competency_summary && (
          <p className="text-[14px] sm:text-[15px] text-[#1F2937] leading-relaxed break-words">
            {skill.competency_summary}
          </p>
        )}

        {/* Low confidence advisory (amber warning for incomplete certainty) */}
        {skill.ai_confidence?.toLowerCase() === "low" && !override && (
          <div className="text-xs text-amber-900 bg-amber-50/70 border border-amber-200 rounded-md px-3 py-2 leading-relaxed">
            Only briefly explored during the interview. AI confidence is low — assessor review or override is recommended if this skill is critical.
          </div>
        )}

        {/* 4. Subtle inset treatment for supporting verbatim evidence */}
        {skill.evidence && skill.evidence.length > 0 && (
          <div className="rounded-lg bg-[#F7F9FA] border border-[#E2E8F0] px-3.5 py-2.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
              <Quote className="h-3 w-3 text-[#0F8F95]" aria-hidden="true" />
              <span>Supporting Interview Evidence ({skill.evidence.length})</span>
            </div>
            <ul className="space-y-1.5">
              {skill.evidence.map((quote, i) => (
                <li
                  key={i}
                  className="text-[13px] text-[#334155] border-l-2 border-[#0F8F95]/40 pl-2.5 py-0.5 break-words leading-relaxed italic"
                >
                  &ldquo;{quote}&rdquo;
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 5. Human correction callout & notes */}
        {override && (
          <div
            role="note"
            aria-label={`Latest assessor override for ${skill.skill_label}`}
            className="rounded-lg border border-[#0F8F95]/30 bg-[#0F8F95]/[0.05] px-3.5 py-2.5 space-y-1"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#0B7479]">
              <span className="inline-flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-[#0F8F95]" aria-hidden="true" />
                Latest Assessor Override: AI {LEVEL_LABELS[override.ai_level ?? aiLevelNum]} → Assessor{" "}
                {LEVEL_LABELS[override.override_level]}
              </span>
              {formattedOverrideTime && (
                <span className="text-[#64748B] font-normal">
                  {formattedOverrideTime}
                </span>
              )}
            </div>
            {override.assessor_notes && (
              <p className="text-[13px] text-[#1F2937] break-words leading-relaxed">
                {override.assessor_notes}
              </p>
            )}
          </div>
        )}

        {/* 6. Predictable footer action / expandable override form */}
        <div className="pt-3 border-t border-dashed border-[#E2E8F0]">
          <OverridePanel
            skill={skill}
            existingOverride={override}
            onSaved={onOverrideSaved}
          />
        </div>
      </CardContent>
    </Card>
  );
}


