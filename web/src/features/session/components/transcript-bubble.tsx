import { cn } from "@/lib/utils";

interface TranscriptBubbleProps {
  speaker: "candidate" | "assessor" | "system" | "ai";
  text: string;
}

export function TranscriptBubble({ speaker, text }: TranscriptBubbleProps) {
  const isCandidate = speaker === "candidate";

  return (
    <div className={cn("flex", isCandidate ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
          isCandidate ? "bg-primary/10 text-foreground" : "bg-muted text-foreground"
        )}
      >
        <span className="mb-0.5 block text-xs font-medium text-muted-foreground">
          {isCandidate ? "Candidate" : "AI"}
        </span>
        {text}
      </div>
    </div>
  );
}
