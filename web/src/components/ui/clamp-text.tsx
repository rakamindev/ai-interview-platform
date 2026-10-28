import * as React from "react";
import { cn } from "@/lib/utils";

const CLAMP = { 2: "line-clamp-2", 3: "line-clamp-3", 6: "line-clamp-6" } as const;

export interface ClampTextProps {
  text: string;
  lines?: keyof typeof CLAMP;
  maxChars?: number;
  expandLabel?: string;
  className?: string;
}

// Long text is clamped to a few lines with a Show more button; unbroken
// strings wrap anywhere instead of pushing the layout sideways.
export function ClampText({ text, lines = 3, maxChars = 240, expandLabel = "Show more", className }: ClampTextProps) {
  const id = React.useId();
  const [expanded, setExpanded] = React.useState(false);
  const long = text.length > maxChars;

  return (
    <div className="min-w-0">
      <p id={id} className={cn("whitespace-pre-line [overflow-wrap:anywhere]", long && !expanded && CLAMP[lines], className)}>
        {text}
      </p>
      {long && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 rounded-sm text-xs font-medium text-teal-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? "Show less" : expandLabel}
        </button>
      )}
    </div>
  );
}
