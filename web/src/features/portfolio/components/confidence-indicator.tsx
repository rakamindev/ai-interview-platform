import { cn } from "@/lib/utils";

type Confidence = "high" | "medium" | "low";

function getLabel(c: string | undefined | null): "HIGH" | "MEDIUM" | "LOW" {
  const normalized = c?.toLowerCase();
  if (normalized === "high") return "HIGH";
  if (normalized === "medium") return "MEDIUM";
  return "LOW";
}

export function ConfidenceIndicator({ confidence }: { confidence: Confidence }) {
  const label = getLabel(confidence);

  if (label === "HIGH") {
    return (
      <span className="flex items-center gap-1 text-xs text-success">
        <span className="size-2 rounded-full bg-success" />
        Confidence: HIGH
      </span>
    );
  }
  if (label === "MEDIUM") {
    return (
      <span className="flex items-center gap-1 text-xs text-warning">
        <span className="size-2 rounded-full bg-warning" />
        Confidence: MEDIUM
      </span>
    );
  }
  return (
    <span className={cn("flex items-center gap-1 text-xs text-destructive")}>
      <span className="size-2 rounded-full bg-destructive" />
      Confidence: LOW
    </span>
  );
}
