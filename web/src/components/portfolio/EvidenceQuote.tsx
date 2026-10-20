import { useState } from "react";

const COLLAPSE_AFTER = 220;

export default function EvidenceQuote({ quote }: { quote: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = quote.length > COLLAPSE_AFTER;
  const shown = isLong && !expanded ? `${quote.slice(0, COLLAPSE_AFTER).trimEnd()}…` : quote;

  return (
    <li className="text-sm text-foreground border-l-2 border-primary/30 pl-3 break-words">
      “{shown}”
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="ml-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </li>
  );
}
