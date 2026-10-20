import { cn } from "@/lib/utils";

interface ConfidenceIndicatorProps {
  confidence: string; // "high" | "medium" | "low" from API
}

function getLabel(c: string): "High" | "Medium" | "Low" {
  const normalized = c?.toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  return "Low";
}

const STYLES = {
  High: "bg-green-50 text-green-800 ring-green-600/20",
  Medium: "bg-muted text-muted-foreground ring-border",
  Low: "bg-amber-50 text-amber-800 ring-amber-600/20",
} as const;

const DOT = {
  High: "bg-green-600",
  Medium: "bg-neutral-400",
  Low: "bg-amber-500",
} as const;

export default function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  const label = getLabel(confidence);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STYLES[label]
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT[label])} aria-hidden="true" />
      {label} confidence
    </span>
  );
}
