interface ConfidenceIndicatorProps {
  confidence: string; // "high" | "medium" | "low" from API
}

function getLabel(c: string): "HIGH" | "MEDIUM" | "LOW" {
  const normalized = c?.toLowerCase();
  if (normalized === "high") return "HIGH";
  if (normalized === "medium") return "MEDIUM";
  return "LOW";
}

const LABEL_CLASSES = {
  HIGH: "bg-green-50 text-green-800",
  MEDIUM: "bg-rakamin-yellow/25 text-rakamin-charcoal",
  LOW: "bg-destructive/10 text-destructive",
};

export default function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  const label = getLabel(confidence);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${LABEL_CLASSES[label]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      Confidence: {label}
    </span>
  );
}
