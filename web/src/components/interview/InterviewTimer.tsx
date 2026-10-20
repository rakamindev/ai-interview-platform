import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface InterviewTimerProps {
  totalSeconds: number;
  onExpired?: () => void;
  running: boolean;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Red in the last minute, amber in the last five, otherwise the normal text colour. */
function timerColor(remaining: number) {
  if (remaining <= 60) return "text-destructive";
  if (remaining <= 300) return "text-amber-500";
  return "text-foreground";
}

export default function InterviewTimer({ totalSeconds, onExpired, running }: Readonly<InterviewTimerProps>) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    setRemaining(totalSeconds);
  }, [totalSeconds]);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) { onExpired?.(); return; }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [running, remaining, onExpired]);

  return (
    <span className={cn("font-mono text-sm font-medium tabular-nums", timerColor(remaining))}>
      ⏱ {formatTime(remaining)}
    </span>
  );
}
