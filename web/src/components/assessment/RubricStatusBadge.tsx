import type { Session } from "@/types";

interface RubricStatusBadgeProps {
  rubric?: Session["rubric"];
  onView?: (version: number) => void;
}

export default function RubricStatusBadge({ rubric, onView }: RubricStatusBadgeProps) {
  const capturedRubric = rubric?.status === "captured" && rubric.version != null;
  const label = capturedRubric ? `Rubric v${rubric.version}` : "Legacy template";

  if (capturedRubric && onView) {
    return (
      <button
        type="button"
        onClick={() => onView(rubric.version!)}
        className="inline-flex rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label={`View changes for rubric version ${rubric.version}`}
      >
        {label}
      </button>
    );
  }

  return (
    <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
      {label}
    </span>
  );
}
