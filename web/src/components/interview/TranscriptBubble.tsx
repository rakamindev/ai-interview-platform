import { cn } from "@/lib/utils";

interface TranscriptBubbleProps {
  speaker: "candidate" | "assessor" | "system" | "ai";
  text: string;
}

export default function TranscriptBubble({ speaker, text }: TranscriptBubbleProps) {
  const isCandidate = speaker === "candidate";

  return (
    <div className={cn("flex w-full", isCandidate ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(100%,20rem)] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
          isCandidate
            ? "bg-primary text-primary-foreground"
            : "bg-white border border-border text-foreground"
        )}
      >
        <span
          className={cn(
            "block text-[11px] font-semibold uppercase tracking-wide mb-1",
            isCandidate ? "text-primary-foreground/80" : "text-muted-foreground"
          )}
        >
          {isCandidate ? "You" : "AI Interviewer"}
        </span>
        {text}
      </div>
    </div>
  );
}
