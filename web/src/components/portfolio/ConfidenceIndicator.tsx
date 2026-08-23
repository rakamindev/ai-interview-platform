import { m } from "@/(paraglide)/messages.js";

interface ConfidenceIndicatorProps {

function getLabel(c: string | undefined): "high" | "medium" | "low" | null {
  if (c == null || c === "") return null;
  const normalized = c.toLowerCase();
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  if (normalized === "low") return "low";
  return null;
}

export default function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  const label = getLabel(confidence);

  if (label === "high") {
    return (
      <span className="flex items-center gap-1 text-xs text-verdict-match">
        <span className="h-2 w-2 rounded-full bg-verdict-match" />
        {m.confidence.high()}
      </span>
    );
  }
  if (label === "medium") {
    return (
      <span className="flex items-center gap-1 text-xs text-verdict-gap">
        <span className="h-2 w-2 rounded-full bg-verdict-gap" />
        {m.confidence.medium()}
      </span>
    );
  }
  if (label === "low") {
    return (
      <span className="flex items-center gap-1 text-xs text-verdict-unknown">
        <span className="h-2 w-2 rounded-full bg-verdict-unknown" />
        {m.confidence.low()}
      </span>
    );
  }
  return null;
}
