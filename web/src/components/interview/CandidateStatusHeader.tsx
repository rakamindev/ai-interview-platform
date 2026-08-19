import { useState, useEffect } from "react";
import { Mic, MicOff, Clock, Radio, MessageSquareText, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { Lang } from "@/utils/candidateI18n";
import { candidateTranslations } from "@/utils/candidateI18n";

interface CandidateStatusHeaderProps {
  totalSeconds: number;
  running: boolean;
  onExpired: () => void;
  onEndEarly: () => void;
  connectionState: "connected" | "reconnecting" | "lost";
  micMuted: boolean;
  onToggleMic: () => void;
  transcriptOpen: boolean;
  onToggleTranscript: () => void;
  lang: Lang;
  onToggleLang: () => void;
}

export function CandidateStatusHeader({
  totalSeconds,
  running,
  onExpired,
  onEndEarly,
  connectionState,
  micMuted,
  onToggleMic,
  transcriptOpen,
  onToggleTranscript,
  lang,
  onToggleLang,
}: CandidateStatusHeaderProps) {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const t = candidateTranslations[lang].live;

  useEffect(() => {
    setSecondsLeft(totalSeconds);
  }, [totalSeconds]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running, onExpired]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const isWarning = secondsLeft <= 300 && secondsLeft > 60; // 5 min
  const isCritical = secondsLeft <= 60; // 1 min

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b px-2.5 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3 shadow-2xs">
      {/* Left: Brand & Connection dot & Timer */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        <span className="font-bold text-xs sm:text-sm text-primary tracking-tight hidden md:inline">
          AI Interview
        </span>

        <div
          className={cn(
            "flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-medium px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border",
            connectionState === "connected" && "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
            connectionState === "reconnecting" && "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse",
            connectionState === "lost" && "bg-destructive/10 border-destructive/20 text-destructive"
          )}
        >
          <Radio className="h-3 w-3 shrink-0" />
          <span className="capitalize hidden sm:inline">{connectionState}</span>
        </div>

        {/* Tiered Timer */}
        <div
          className={cn(
            "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border text-[11px] sm:text-xs font-mono font-bold transition-all",
            !isWarning && !isCritical && "bg-muted/60 border-border text-foreground",
            isWarning && "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 animate-pulse",
            isCritical && "bg-destructive/10 border-destructive/30 text-destructive animate-ping [animation-duration:2s]"
          )}
        >
          <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
          <span>{mm}:{ss}</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Language switch */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleLang}
          className="h-7 sm:h-8 px-1.5 sm:px-2 text-xs font-semibold"
          title="Switch Language"
        >
          {lang.toUpperCase()}
        </Button>

        {/* Transcript toggle */}
        <Button
          variant={transcriptOpen ? "secondary" : "outline"}
          size="sm"
          onClick={onToggleTranscript}
          className="h-8 px-2 sm:px-2.5 text-xs flex items-center gap-1.5"
        >
          <MessageSquareText className="h-3.5 w-3.5" />
          <span className="hidden md:inline">{transcriptOpen ? t.toggleTranscriptHide : t.toggleTranscriptShow}</span>
        </Button>

        {/* Mic toggle */}
        <Button
          variant={micMuted ? "destructive" : "outline"}
          size="sm"
          onClick={onToggleMic}
          className="h-8 px-2 sm:px-2.5 text-xs flex items-center gap-1.5"
        >
          {micMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{micMuted ? t.micMuted : t.micOn}</span>
        </Button>

        {/* End interview */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive hover:bg-destructive/10">
              <Power className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">{t.endBtn}</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.endDialogTitle}</AlertDialogTitle>
              <AlertDialogDescription>{t.endDialogBody}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.endDialogCancel}</AlertDialogCancel>
              <AlertDialogAction onClick={onEndEarly} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {t.endDialogConfirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </header>
  );
}
