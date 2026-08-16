import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TranscriptBubbleProps {
  speaker: "candidate" | "assessor" | "system" | "ai";
  text: string;
}

export default function TranscriptBubble({ speaker, text }: TranscriptBubbleProps) {
  const isCandidate = speaker === "candidate";
  const [visibleChars, setVisibleChars] = useState(0);

  // Typewriter reveal: the turn text is delivered whole by the backend, so we
  // reveal it progressively (~1s max) to give the transcript a streaming feel
  // instead of popping in abruptly.
  useEffect(() => {
    setVisibleChars(0);
    if (!text) return;
    const step = Math.max(1, Math.ceil(text.length / 60)); // ~60 ticks ≈ 1s
    let current = 0;
    const id = setInterval(() => {
      current = Math.min(text.length, current + step);
      setVisibleChars(current);
      if (current >= text.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [text]);

  const typing = visibleChars < text.length;

  return (
    <div
      className={cn(
        "flex animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
        isCandidate ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isCandidate
            ? "bg-primary/10 text-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <span className="block text-xs font-medium mb-0.5 text-muted-foreground">
          {isCandidate ? "You" : "AI"}
        </span>
        {text.slice(0, visibleChars)}
        {typing && <span className="opacity-40">▍</span>}
      </div>
    </div>
  );
}
