import type { Session } from "@/types";

interface RubricStatusBadgeProps {
  rubric?: Session["rubric"];
}

export default function RubricStatusBadge({ rubric }: RubricStatusBadgeProps) {
  const capturedRubric = rubric?.status === "captured" && rubric.version != null;

  return (
    <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
      {capturedRubric ? `Rubric v${rubric.version}` : "Legacy template"}
    </span>
  );
}
