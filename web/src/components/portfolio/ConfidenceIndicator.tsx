import type { Confidence } from "@/types";

const STYLES: Record<Confidence, { dot: string; text: string; label: string }> = {
  high: { dot: "bg-green-500", text: "text-green-700", label: "High confidence" },
  medium: { dot: "bg-amber-400", text: "text-amber-700", label: "Medium confidence" },
  low: { dot: "bg-destructive", text: "text-destructive", label: "Low confidence" },
};

export default function ConfidenceIndicator({ confidence }: { confidence: Confidence | null }) {
  if (!confidence) return null;
  const style = STYLES[confidence];

  return (
    <span className={`flex items-center gap-1 text-xs ${style.text}`}>
      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}
