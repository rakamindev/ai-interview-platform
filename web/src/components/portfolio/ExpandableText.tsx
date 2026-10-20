import { useId, useState } from "react";
import { cn } from "@/lib/utils";

interface ExpandableTextProps {
  text: string;
  className?: string;
}

// Above this length the text is likely to run past four lines in a card, so it starts collapsed.
// A character count, not a measurement: it behaves the same in every browser and in tests.
const COLLAPSE_AFTER = 280;

/** Long quotes and summaries collapse behind "Show more" instead of stretching the card (AC-28). */
export default function ExpandableText({ text, className }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const long = text.length > COLLAPSE_AFTER;

  return (
    <div>
      <p id={id} className={cn("break-words [overflow-wrap:anywhere]", long && !expanded && "line-clamp-4", className)}>
        {text}
      </p>
      {long && (
        <button
          type="button"
          className="mt-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
