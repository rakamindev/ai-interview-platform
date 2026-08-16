import { useState } from "react";
import { cn } from "@/lib/utils";

interface ClampTextProps {
  text: string;
  className?: string;
  maxLines?: number;
}

export default function ClampText({ text, className, maxLines = 3 }: ClampTextProps) {
  const [expanded, setExpanded] = useState(false);
  const needsClamp = text.length > 160;

  if (!needsClamp) {
    return <p className={className}>{text}</p>;
  }

  return (
    <div>
      <p
        className={cn(className, !expanded && "line-clamp-3")}
        style={!expanded ? { WebkitLineClamp: maxLines } : undefined}
      >
        {text}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 text-xs text-primary hover:underline"
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}
