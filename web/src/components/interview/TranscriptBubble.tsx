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
          "max-w-[85%] px-4 py-2.5 text-[15px] leading-relaxed shadow-sm",
          isCandidate
            ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
            : "rounded-2xl rounded-bl-md border bg-card text-foreground"
        )}
      >
        <span
          className={cn(
            "mb-1 block text-[11px] font-semibold uppercase tracking-wider",
            isCandidate ? "text-primary-foreground" : "text-primary"
          )}
        >
          {isCandidate ? "You" : "Interviewer"}
        </span>
        {text}
      </div>
    </div>
  );
}
