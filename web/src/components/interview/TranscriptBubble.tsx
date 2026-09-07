import { cn } from "@/lib/utils";

interface TranscriptBubbleProps {
  speaker: "candidate" | "assessor" | "system" | "ai";
  text: string;
}

export default function TranscriptBubble({ speaker, text }: TranscriptBubbleProps) {
  const isCandidate = speaker === "candidate";

  return (
    <div className={cn("flex animate-turn-in motion-safe-only", isCandidate ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          // break-words + a max width keep a long unbroken answer from widening
          // the column on a phone.
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words",
          isCandidate
            ? "rounded-br-md bg-primary/10 text-foreground"
            : "rounded-bl-md bg-muted text-foreground"
        )}
      >
        <span className="mb-0.5 block text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
          {isCandidate ? "You" : "Interviewer"}
        </span>
        {text}
      </div>
    </div>
  );
}
