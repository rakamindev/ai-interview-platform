import { cn } from "@/lib/utils";

interface TranscriptBubbleProps {
  speaker: "candidate" | "assessor" | "system" | "ai";
  text: string;
  // The candidate sees their own turns as "You"; assessors need to see "Candidate".
  candidateLabel?: string;
}

export default function TranscriptBubble({
  speaker,
  text,
  candidateLabel = "You",
}: TranscriptBubbleProps) {
  const isCandidate = speaker === "candidate";

  return (
    <div className={cn("flex", isCandidate ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
          isCandidate
            ? "rounded-br-md bg-primary/10 text-foreground"
            : "rounded-bl-md bg-muted text-foreground",
        )}
      >
        <span className="block text-xs font-medium mb-0.5 text-muted-foreground">
          {isCandidate ? candidateLabel : "AI"}
        </span>
        {text}
      </div>
    </div>
  );
}
