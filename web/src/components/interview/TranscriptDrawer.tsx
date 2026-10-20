import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import TranscriptBubble from "./TranscriptBubble";
import { X, MessageSquare, Info } from "lucide-react";
import type { TranscriptTurn } from "@/types";

interface TranscriptDrawerProps {
  open: boolean;
  onClose: () => void;
  transcript: Pick<TranscriptTurn, "speaker" | "text">[];
}

export default function TranscriptDrawer({
  open,
  onClose,
  transcript,
}: TranscriptDrawerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, transcript.length]);

  if (!open) return null;

  return (
    <aside
      aria-label="Live interview transcript drawer"
      className="fixed inset-y-0 right-0 z-40 w-80 sm:w-96 bg-background border-l flex flex-col transition-transform duration-200"
    >
      {/* Header matching Google Meet style */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-foreground">In-call messages</h2>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Live Transcript</span>
            <span>•</span>
            <span>{transcript.length} {transcript.length === 1 ? "turn" : "turns"}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
          aria-label="Close transcript drawer"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Subtitle info banner from screenshot */}
      <div className="p-3 mx-3 my-2 rounded-lg bg-muted/60 border text-[11px] text-muted-foreground space-y-1">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Info className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>Real-time voice transcription active</span>
        </div>
        <p>
          Messages and spoken audio turns are processed live and saved for competency rubric evaluation.
        </p>
      </div>

      {/* Transcript turns list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {transcript.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-xs text-muted-foreground space-y-2">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No chat messages yet</p>
            <p>Spoken responses from you and the AI interviewer will appear here live.</p>
          </div>
        ) : (
          transcript.map((turn, index) => (
            <TranscriptBubble
              key={index}
              speaker={turn.speaker}
              text={turn.text}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </aside>
  );
}
