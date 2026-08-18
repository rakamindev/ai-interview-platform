import { cn } from "@/lib/utils";

interface TranscriptBubbleProps {
  speaker: "candidate" | "assessor" | "system" | "ai";
  text: string;
  /**
   * Who is reading. The candidate sees their own turns as "You"; an assessor
   * watching the live monitor sees them as "Candidate" — the same string
   * labelled "You" on a monitoring screen names the wrong person.
   */
  perspective?: "candidate" | "observer";
}

export default function TranscriptBubble({
  speaker,
  text,
  perspective = "candidate",
}: TranscriptBubbleProps) {
  const isCandidate = speaker === "candidate";
  const label = isCandidate ? (perspective === "observer" ? "Candidate" : "You") : "AI";

  // Observers read a transcript, not a chat: rows stay in one column so the
  // eye runs down a single edge instead of zig-zagging between two.
  const alignRight = isCandidate && perspective === "candidate";

  return (
    <div className={cn("flex", alignRight ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2",
          isCandidate ? "bg-primary/10 text-foreground" : "bg-muted text-foreground",
        )}
      >
        <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        {/* The candidate's own words are quoted material and carry the serif;
            everything the machine said stays in the interface sans. */}
        <span
          className={cn(
            isCandidate
              ? "font-serif text-[15px] leading-relaxed"
              : "text-sm leading-relaxed",
            "[overflow-wrap:anywhere]",
          )}
        >
          {text}
        </span>
      </div>
    </div>
  );
}
