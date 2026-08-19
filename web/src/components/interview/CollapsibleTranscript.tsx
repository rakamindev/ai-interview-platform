import { useEffect, useRef } from "react";
import { Bot, User, MessageSquareText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/types";

interface CollapsibleTranscriptProps {
  isOpen?: boolean;
  onClose?: () => void;
  turns: Pick<TranscriptTurn, "speaker" | "text">[];
  emptyText?: string;
  className?: string;
  variant?: "inline" | "floating";
}

export function CollapsibleTranscript({
  isOpen = true,
  onClose,
  turns,
  emptyText = "Transcript will appear here in real-time.",
  className,
  variant = "inline",
}: CollapsibleTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [turns]);

  if (!isOpen) return null;

  if (variant === "floating") {
    return (
      <aside className="fixed bottom-0 sm:bottom-4 right-0 sm:right-4 z-40 w-full sm:w-96 max-h-[50vh] sm:max-h-[65vh] bg-background/95 backdrop-blur-md border border-border shadow-2xl rounded-t-2xl sm:rounded-2xl flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <MessageSquareText className="h-3.5 w-3.5 text-primary" />
            <span>Live Transcript</span>
            <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-mono">
              {turns.length}
            </span>
          </h4>
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
            >
              ×
            </button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
          {renderTurns(turns, emptyText)}
        </div>
      </aside>
    );
  }

  // Inline Centerpiece Layout
  return (
    <div
      className={cn(
        "w-full flex flex-col bg-card/80 backdrop-blur-md border border-border/80 rounded-2xl shadow-xs overflow-hidden transition-all",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <MessageSquareText className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold text-foreground">Live Conversation</span>
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-mono font-medium">
            {turns.length} {turns.length === 1 ? "turn" : "turns"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="hidden sm:inline font-mono">Streaming audio & text</span>
        </div>
      </div>

      {/* Message Feed */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 text-xs scroll-smooth"
      >
        {renderTurns(turns, emptyText)}
      </div>
    </div>
  );
}

function renderTurns(turns: Pick<TranscriptTurn, "speaker" | "text">[], emptyText: string) {
  if (turns.length === 0) {
    return (
      <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center p-6 space-y-2 text-muted-foreground">
        <div className="w-10 h-10 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground/80">
          <Sparkles className="h-5 w-5 animate-pulse" />
        </div>
        <p className="text-xs font-medium text-foreground">{emptyText}</p>
        <p className="text-[11px] text-muted-foreground max-w-xs">
          Speak clearly into your microphone when the AI interviewer asks a question.
        </p>
      </div>
    );
  }

  return turns.map((turn, i) => {
    // Robust speaker identification
    const isCandidate = turn.speaker === "candidate";
    const isAI = !isCandidate;

    return (
      <div
        key={i}
        className={cn(
          "flex gap-2.5 animate-in fade-in-50 slide-in-from-bottom-2 duration-200",
          isCandidate ? "flex-row-reverse" : "flex-row"
        )}
      >
        {/* Avatar */}
        <div
          className={cn(
            "w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-xs text-white",
            isAI
              ? "bg-gradient-to-tr from-cyan-600 to-teal-500"
              : "bg-gradient-to-tr from-teal-500 to-emerald-500"
          )}
        >
          {isAI ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
        </div>

        {/* Message Bubble */}
        <div
          className={cn(
            "max-w-[85%] sm:max-w-[78%] p-3 rounded-2xl space-y-1 border shadow-2xs transition-all",
            isAI
              ? "bg-muted/40 border-border/80 text-foreground rounded-tl-sm"
              : "bg-teal-500/10 dark:bg-teal-500/15 border-teal-500/30 text-foreground rounded-tr-sm"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "text-[10px] font-semibold tracking-wide uppercase",
                isAI ? "text-primary" : "text-teal-600 dark:text-teal-400"
              )}
            >
              {isAI ? "AI Interviewer" : "You"}
            </span>
          </div>
          <p className="leading-relaxed whitespace-pre-wrap text-xs text-foreground">
            {turn.text}
          </p>
        </div>
      </div>
    );
  });
}
