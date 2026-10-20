import { cn } from "@/lib/utils";

interface TranscriptBubbleProps {
  speaker: "candidate" | "assessor" | "system" | "ai";
  text: string;
}

export default function TranscriptBubble({ speaker, text }: TranscriptBubbleProps) {
  const isCandidate = speaker === "candidate";

  return (
    <div className={cn("flex", isCandidate ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] px-3.5 py-2 text-sm border",
          isCandidate
            ? "bg-primary/10 border-primary/20 text-foreground"
            : "bg-muted border-border text-foreground"
        )}
      >
        <span className="block text-xs font-medium mb-0.5 text-muted-foreground">
          {isCandidate ? "You" : "AI"}
        </span>
        {text}
      </div>
    </div>
  );
}
