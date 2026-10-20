import { cn } from "@/lib/utils";

interface ConfidenceIndicatorProps {
  confidence: string; // "high" | "medium" | "low" from API
  className?: string;
}

function getLabel(c: string): "HIGH" | "MEDIUM" | "LOW" {
  const normalized = c?.toLowerCase();
  if (normalized === "high") return "HIGH";
  if (normalized === "medium") return "MEDIUM";
  return "LOW";
}

export default function ConfidenceIndicator({ confidence, className }: ConfidenceIndicatorProps) {
  const label = getLabel(confidence);

  if (label === "HIGH") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 select-none",
          className
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Confidence: HIGH
      </span>
    );
  }
  if (label === "MEDIUM") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 select-none",
          className
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Confidence: MEDIUM
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 select-none",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
      Confidence: LOW
    </span>
  );
}
