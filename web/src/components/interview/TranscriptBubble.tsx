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
          "max-w-[90%] sm:max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed border",
          isCandidate
            ? "border-primary/30 bg-primary/8 text-foreground rounded-tl-md rounded-tr-md rounded-bl-md"
            : "border-foreground/10 bg-card text-foreground rounded-tr-md rounded-tl-md rounded-br-md"
        )}
      >
        <span
          className={cn(
            "block text-[10px] uppercase tracking-wider font-medium mb-1",
            isCandidate ? "text-primary" : "text-muted-foreground"
          )}
        >
          {isCandidate ? "You" : "Interviewer"}
        </span>
        {text}
      </div>
    </div>
  );
}
