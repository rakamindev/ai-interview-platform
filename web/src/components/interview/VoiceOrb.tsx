import { cn } from "@/lib/utils";
import { Mic, Bot, Sparkles, Volume2 } from "lucide-react";

export type OrbSpeaker = "ai" | "candidate" | "idle" | "connecting";

interface VoiceOrbProps {
  speaker: OrbSpeaker;
  label?: string;
  sublabel?: string;
  compact?: boolean;
}

export default function VoiceOrb({ speaker, label, sublabel, compact = false }: VoiceOrbProps) {
  const isAI = speaker === "ai";
  const isCandidate = speaker === "candidate";
  const isConnecting = speaker === "connecting";

  return (
    <div className={cn("flex flex-col items-center justify-center select-none transition-all", compact ? "gap-2 py-1" : "gap-3 py-2")}>
      {/* Orb Outer Ripple Container */}
      <div className={cn("relative flex items-center justify-center", compact ? "w-28 h-28 sm:w-32 sm:h-32" : "w-36 h-36 sm:w-40 sm:h-40")}>
        {/* Ripple Rings */}
        {isAI && (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping opacity-75" />
            <div className="absolute inset-2 rounded-full bg-primary/10 animate-pulse" />
            <div className="absolute inset-4 rounded-full border border-primary/30 animate-spin [animation-duration:8s]" />
          </>
        )}

        {isCandidate && (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-teal-400/30 animate-ping opacity-60 [animation-duration:1.5s]" />
            <div className="absolute inset-2 rounded-full bg-teal-500/15 animate-pulse" />
          </>
        )}

        {isConnecting && (
          <div className="absolute inset-1 rounded-full border-2 border-dashed border-primary/40 animate-spin [animation-duration:4s]" />
        )}

        {/* Central Core Orb */}
        <div
          className={cn(
            "relative rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-500 text-white",
            compact ? "w-20 h-20 sm:w-24 sm:h-24" : "w-24 h-24 sm:w-28 sm:h-28",
            isAI && "bg-gradient-to-tr from-cyan-600 to-teal-400 shadow-primary/30 scale-105",
            isCandidate && "bg-gradient-to-tr from-teal-500 to-emerald-400 shadow-teal-500/30 scale-105",
            isConnecting && "bg-gradient-to-tr from-slate-600 to-slate-400 shadow-slate-500/20 animate-pulse",
            speaker === "idle" && "bg-gradient-to-tr from-slate-700 to-slate-500 shadow-muted/20 opacity-90"
          )}
        >
          {/* Inner ambient glow */}
          <div className="absolute inset-1.5 rounded-full bg-white/10 backdrop-blur-xs" />

          {/* Center Icon */}
          <div className="relative z-10 flex flex-col items-center gap-1">
            {isAI && <Bot className={cn(compact ? "h-6 w-6" : "h-7 w-7", "animate-bounce [animation-duration:2s]")} />}
            {isCandidate && <Mic className={cn(compact ? "h-6 w-6" : "h-7 w-7", "animate-pulse")} />}
            {isConnecting && <Sparkles className={cn(compact ? "h-6 w-6" : "h-7 w-7", "animate-spin")} />}
            {speaker === "idle" && <Volume2 className={cn(compact ? "h-6 w-6" : "h-7 w-7", "opacity-80")} />}
          </div>

          {/* Floating Soundwave Bars */}
          <div className="relative z-10 flex items-center gap-0.5 mt-1 h-3">
            {[40, 80, 100, 70, 50, 90, 60].map((h, i) => (
              <span
                key={i}
                className={cn(
                  "w-0.5 bg-white/80 rounded-full transition-all duration-150",
                  isAI || isCandidate ? "animate-pulse" : "h-0.5"
                )}
                style={{
                  height: isAI || isCandidate ? `${h}%` : "2px",
                  animationDelay: `${i * 120}ms`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Label status */}
      <div className="text-center space-y-0.5">
        <div
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border shadow-xs transition-colors",
            isAI && "bg-primary/10 border-primary/30 text-primary",
            isCandidate && "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
            isConnecting && "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 animate-pulse",
            speaker === "idle" && "bg-muted border-border text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              isAI && "bg-primary animate-ping",
              isCandidate && "bg-emerald-500 animate-ping",
              isConnecting && "bg-amber-500",
              speaker === "idle" && "bg-muted-foreground"
            )}
          />
          <span>{label}</span>
        </div>
        {sublabel && <p className="text-[11px] text-muted-foreground">{sublabel}</p>}
      </div>
    </div>
  );
}
