import { useId, useState } from "react";
import { cn } from "@/lib/utils";

interface ExpandableTextProps {
  text: string;
  /** Texts longer than this are clamped to four lines with a toggle. */
  maxChars?: number;
  className?: string;
}

export default function ExpandableText({ text, maxChars = 320, className }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const long = text.length > maxChars;

  return (
    <div className="space-y-1">
      <p id={id} className={cn("whitespace-pre-line break-words", long && !expanded && "line-clamp-4", className)}>
        {text}
      </p>
      {long && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((v) => !v)}
          className="rounded-sm text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
