import { cn } from "@/lib/utils";
import { Bot, UserRound } from "lucide-react";

type Speaker = "candidate" | "assessor" | "system" | "ai";

interface TranscriptBubbleProps {
  speaker: Speaker;
  text: string;
  /** Label shown for the candidate. The candidate's own view says "You". */
  candidateLabel?: string;
  /** Label shown for the AI interviewer. */
  aiLabel?: string;
  /** Clock time shown next to the speaker label. */
  timestamp?: string;
  /** Show speaker icons. Off for the compact live view. */
  showIcons?: boolean;
}

export default function TranscriptBubble({
  speaker,
  text,
  candidateLabel = "You",
  aiLabel = "AI",
  timestamp,
  showIcons = false,
}: TranscriptBubbleProps) {
  const isCandidate = speaker === "candidate";

  return (
    <div className={cn("flex", isCandidate ? "justify-end" : "justify-start")}>
      <div className={cn("min-w-0 max-w-[92%] sm:max-w-[85%] lg:max-w-[65ch]", showIcons && "lg:max-w-[70ch]")}>
        <div className={cn("flex items-center gap-2", isCandidate && "justify-end")}>
          {showIcons && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              {isCandidate
                ? <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
                : <Bot aria-hidden="true" className="h-3.5 w-3.5" />}
            </span>
          )}
          <span className="text-sm font-medium">
            {isCandidate ? candidateLabel : aiLabel}
          </span>
          {timestamp && (
            <span className="text-xs tabular-nums text-muted-foreground">{timestamp}</span>
          )}
        </div>
        <div
          className={cn(
            "mt-2 rounded-xl px-4 py-3 text-left",
            isCandidate ? "bg-primary/10" : "bg-muted"
          )}
        >
          <p className="break-words whitespace-pre-wrap text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}
