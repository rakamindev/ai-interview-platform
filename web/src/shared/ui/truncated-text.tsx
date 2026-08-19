import { useState } from "react";

interface TruncatedTextProps {
  text: string;
  maxLength?: number;
  className?: string;
}

export default function TruncatedText({ text, maxLength = 220, className }: TruncatedTextProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > maxLength;
  const shown = expanded || !isLong ? text : `${text.slice(0, maxLength).trimEnd()}…`;

  return (
    <span className={className}>
      {shown}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-1.5 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </span>
  );
}
