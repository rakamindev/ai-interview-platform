import { useState } from "react";
import { clampText } from "@/features/hiring/decision";

interface ExpandableTextProps {
  value?: string | null;
  limit?: number;
  className?: string;
  emptyLabel?: string;
}

export default function ExpandableText({
  value,
  limit = 280,
  className,
  emptyLabel = "Nothing was written for this section.",
}: ExpandableTextProps) {
  const [open, setOpen] = useState(false);
  const source = value?.trim() ?? "";

  if (!source) {
    return <p className={className}>{emptyLabel}</p>;
  }

  const preview = clampText(source, limit);

  return (
    <div className="space-y-1">
      <p className={className}>{open ? source : preview.text}</p>
      {preview.truncated && (
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Show less" : "Show full text"}
        </button>
      )}
    </div>
  );
}
