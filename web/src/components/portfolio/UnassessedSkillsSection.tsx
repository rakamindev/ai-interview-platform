import { Card, CardContent } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";
import { LEVEL_LABELS } from "@/utils/constants";
import type { UnassessedSkill } from "@/types";

interface UnassessedSkillsSectionProps {
  skills: UnassessedSkill[];
}

export default function UnassessedSkillsSection({
  skills,
}: UnassessedSkillsSectionProps) {
  if (!skills || skills.length === 0) return null;

  return (
    <section aria-label="Unassessed configured skills" className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-[#1F2937] flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-[#64748B] shrink-0" aria-hidden="true" />
          Unassessed Skills ({skills.length})
        </h2>
        <p className="text-[13px] text-[#64748B] leading-relaxed">
          These configured skills lacked sufficient interview probing to assign a valid L1–L5 rating. They are marked{" "}
          <span className="font-medium text-[#1F2937]">Not assessed</span> in Fit/Gap reports rather than penalized as a skill gap.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {skills.map((skill, idx) => {
          const isInsufficient = skill.reason === "insufficient_evidence";
          const badgeLabel = isInsufficient
            ? `Insufficient Evidence (${skill.probe_count} probe${skill.probe_count !== 1 ? "s" : ""})`
            : "Not Probed (0 probes)";

          return (
            <Card
              key={skill.skill_id ?? `${skill.skill_label}-${idx}`}
              className="bg-white border-dashed border-slate-300 shadow-none"
            >
              <CardContent className="p-4 flex flex-col justify-between gap-2.5 h-full">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold text-[#1F2937] break-words">
                      {skill.skill_label}
                    </span>
                    <span
                      className={
                        isInsufficient
                          ? "inline-flex items-center shrink-0 text-xs font-medium px-2 py-0.5 rounded-md border bg-amber-50 text-amber-900 border-amber-200"
                          : "inline-flex items-center shrink-0 text-xs font-medium px-2 py-0.5 rounded-md border bg-slate-100 text-slate-700 border-slate-200"
                      }
                    >
                      {badgeLabel}
                    </span>
                  </div>
                  {skill.expected_level != null && (
                    <p className="text-xs font-medium text-[#64748B]">
                      Target level: {LEVEL_LABELS[skill.expected_level] ?? `L${skill.expected_level}`}
                    </p>
                  )}
                </div>

                <p className="text-xs text-[#64748B] leading-relaxed pt-2 border-t border-dashed border-[#E2E8F0]">
                  {isInsufficient
                    ? "Topic was initiated, but session ended before enough behavioral evidence was gathered."
                    : "Session ended before the interviewer reached this skill."}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
