import { Bot, CheckCheck, Pencil, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUtc } from "@/utils/datetime";
import type { LevelSource, SkillReview } from "@/types";

export interface LevelSourceMarkerProps {
  source: LevelSource | null;
  aiLevel: number | null;
  review: SkillReview | null | undefined;
  variant?: "compact" | "detailed";
  className?: string;
}

function describe(source: LevelSource, aiLevel: number | null): { text: string; icon: LucideIcon } {
  if (source === "assessor_override") {
    return { text: `Assessor override (AI ${aiLevel ? `L${aiLevel}` : "not assessed"})`, icon: Pencil };
  }
  if (source === "assessor_confirmed") return { text: "Confirmed by assessor", icon: CheckCheck };
  return { text: "AI rating, not reviewed", icon: Bot };
}

// Where a level comes from. The detailed variant adds who reviewed it, when
// (UTC, as in the PDF) and the note.
export function LevelSourceMarker({ source, aiLevel, review, variant = "compact", className }: LevelSourceMarkerProps) {
  if (!source) return null;
  const { text, icon: Icon } = describe(source, aiLevel);

  return (
    <div className={cn("min-w-0 space-y-1 text-xs", className)}>
      <span className="inline-flex items-center gap-1 font-medium text-foreground">
        <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>{text}</span>
      </span>
      {variant === "detailed" && review && (
        <div className="space-y-1 text-muted-foreground">
          <p>{`Assessor #${review.actor_id}, ${formatUtc(review.at)}`}</p>
          {review.notes ? (
            <blockquote className="whitespace-pre-line border-l-2 pl-2 text-foreground [overflow-wrap:anywhere]">
              {review.notes}
            </blockquote>
          ) : (
            <p>No note</p>
          )}
        </div>
      )}
    </div>
  );
}
