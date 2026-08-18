import React from "react";
import { cn } from "@/lib/utils";

interface TranscriptBubbleProps {
  speaker: "candidate" | "assessor" | "system" | "ai";
  text: string;
}

function TranscriptBubbleComponent({ speaker, text }: TranscriptBubbleProps) {
  const isCandidate = speaker === "candidate";

  return (
    <div className={cn("flex", isCandidate ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3.5 py-2 text-sm leading-relaxed",
          isCandidate
            ? "bg-primary/10 text-foreground"
            : "bg-muted/80 text-foreground"
        )}
      >
        <span className="block text-xs font-semibold mb-0.5 text-muted-foreground">
          {isCandidate ? "You" : "AI"}
        </span>
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

export default React.memo(TranscriptBubbleComponent);
