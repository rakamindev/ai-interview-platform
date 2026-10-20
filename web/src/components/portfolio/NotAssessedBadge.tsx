import { cn } from "@/lib/utils";

interface NotAssessedBadgeProps {
  size?: "sm" | "md";
  className?: string;
}

/**
 * Stands in for a LevelBadge when a skill has no level: the interview didn't reach it, or the AI
 * couldn't rate it. Deliberately neutral (dashed, no level color) and labelled in words, so it never
 * reads as a low score.
 */
export default function NotAssessedBadge({ size = "md", className }: NotAssessedBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded border border-dashed border-muted-foreground/40",
        "text-muted-foreground font-medium text-center leading-tight",
        size === "md" ? "px-2 py-2 min-w-14 text-xs" : "px-2 py-1 min-w-10 text-xs",
        className
      )}
    >
      Not assessed
    </div>
  );
}
