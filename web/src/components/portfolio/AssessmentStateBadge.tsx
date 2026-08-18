import { cn } from "@/lib/utils";
import type { AssessmentState } from "@/types";

const META: Record<AssessmentState, { label: string; classes: string }> = {
  assessed:           { label: "Assessed",           classes: "bg-teal-100 text-teal-700" },
  partially_assessed: { label: "Partial",            classes: "bg-amber-100 text-amber-700" },
  not_assessed:       { label: "Not assessed",       classes: "bg-neutral-200 text-neutral-600" },
  discovered:         { label: "Discovered",         classes: "bg-purple-100 text-purple-700" },
};

export default function AssessmentStateBadge({ state }: { state: AssessmentState }) {
  const m = META[state];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", m.classes)}>
      {m.label}
    </span>
  );
}
