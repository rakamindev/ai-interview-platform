import { Badge } from "@/components/ui/badge";
import { ASSESSMENT_STATUS_BADGE, ASSESSMENT_STATUS_LABEL, assessmentStatusOf } from "@/utils/evaluation";
import type { EvaluationSkillSummary } from "@/types";

interface AssessmentStatusBadgeProps {
  skill: EvaluationSkillSummary;
  size?: "sm" | "md";
}

export default function AssessmentStatusBadge({ skill, size = "sm" }: AssessmentStatusBadgeProps) {
  const status = assessmentStatusOf(skill);
  return (
    <Badge variant="default" className={`${ASSESSMENT_STATUS_BADGE[status]} ${size === "sm" ? "text-[10px]" : "text-xs"}`}>
      {ASSESSMENT_STATUS_LABEL[status]}
    </Badge>
  );
}