import { cn } from "@/lib/utils";

interface TranscriptBubbleProps {
  speaker: "candidate" | "assessor" | "system" | "ai";
  text: string;
}

const speakerLabels: Record<TranscriptBubbleProps["speaker"], string> = {
  candidate: "You",
  ai: "AI",
  assessor: "Assessor",
  system: "System",
};

export default function TranscriptBubble({ speaker, text }: TranscriptBubbleProps) {
  const isCandidate = speaker === "candidate";

  return (
    <div className={cn("flex", isCandidate ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[82%] rounded-[14px] border px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
          isCandidate
            ? "rounded-br-[4px] border-brand-soft bg-brand-soft text-foreground"
            : "rounded-bl-[4px] border-border bg-surface-alt text-foreground"
        )}
      >
        <span
          className={cn(
            "mb-0.5 block text-[11px] font-semibold uppercase tracking-wide",
            isCandidate ? "text-brand-deep" : "text-faint"
          )}
        >
          {speakerLabels[speaker]}
        </span>
        {text}
      </div>
    </div>
  );
}
