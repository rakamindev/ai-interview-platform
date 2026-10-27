import { cn } from "@/lib/utils";
import { Mic, Volume2, Sparkles, BrainCircuit } from "lucide-react";
import type { InterviewState } from "@/types";

interface AiLiveOrbProps {
  speaker: "ai" | "candidate" | null;
  state: InterviewState;
  className?: string;
}

export default function AiLiveOrb({ speaker, state, className }: AiLiveOrbProps) {
  const isAi = speaker === "ai";
  const isCandidate = speaker === "candidate";
  const isDraining = state === "draining_audio";
  const isConnecting = state === "connecting";

  // Orb theme colors
  let orbBg = "from-slate-700 via-slate-800 to-slate-900";
  let ringColor = "border-slate-300/20";
  let glowColor = "shadow-indigo-500/10";
  let statusBadge = (
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
      <Sparkles className="h-3.5 w-3.5 text-slate-400" />
      <span>AI Interviewer Ready — Speak anytime</span>
    </div>
  );

  if (isConnecting) {
    statusBadge = (
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200 animate-pulse">
        <Sparkles className="h-3.5 w-3.5" />
        <span>Initializing Neural Audio Session...</span>
      </div>
    );
  } else if (isDraining) {
    orbBg = "from-purple-600 via-indigo-600 to-indigo-900";
    ringColor = "border-purple-400/40 animate-ping";
    glowColor = "shadow-purple-500/40";
    statusBadge = (
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200">
        <BrainCircuit className="h-3.5 w-3.5 animate-spin" />
        <span>Synthesizing Interview Transcript...</span>
      </div>
    );
  } else if (isAi) {
    orbBg = "from-indigo-500 via-blue-600 to-cyan-500";
    ringColor = "border-cyan-400/50 animate-pulse";
    glowColor = "shadow-cyan-500/50";
    statusBadge = (
      <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 shadow-sm">
        <Volume2 className="h-3.5 w-3.5 text-blue-600 animate-bounce" />
        <span>AI Pewawancara Sedang Berbicara</span>
      </div>
    );
  } else if (isCandidate) {
    orbBg = "from-emerald-500 via-teal-600 to-teal-800";
    ringColor = "border-emerald-400/50 animate-pulse";
    glowColor = "shadow-emerald-500/40";
    statusBadge = (
      <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 shadow-sm">
        <Mic className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
        <span>Suara Anda Terdengar (Merekam Respon)</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center gap-5 my-2 select-none", className)}>
      {/* Dynamic Animated Central Orb */}
      <div className="relative flex items-center justify-center">
        {/* Outer ambient wave rings */}
        {(isAi || isCandidate || isDraining) && (
          <div
            className={cn(
              "absolute w-40 h-40 sm:w-44 sm:h-44 rounded-full border border-dashed transition-all duration-700 opacity-60",
              ringColor
            )}
          />
        )}
        <div
          className={cn(
            "absolute w-32 h-32 sm:w-36 sm:h-36 rounded-full border transition-all duration-500 opacity-40",
            ringColor
          )}
        />

        {/* Central Core Sphere */}
        <div
          className={cn(
            "relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr shadow-2xl flex items-center justify-center transition-all duration-500 transform",
            orbBg,
            glowColor,
            isAi ? "scale-105" : isCandidate ? "scale-100" : "scale-95 opacity-90"
          )}
        >
          {/* Inner Light Flare / Specular highlight */}
          <div className="absolute top-2 left-3 w-8 h-4 rounded-full bg-white/30 blur-[2px] transform -rotate-12" />

          {/* Center Graphic */}
          {isAi ? (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-6 bg-white rounded-full animate-bounce delay-75" />
              <span className="w-1.5 h-10 bg-white rounded-full animate-bounce delay-150" />
              <span className="w-1.5 h-7 bg-white rounded-full animate-bounce delay-200" />
              <span className="w-1.5 h-4 bg-white rounded-full animate-bounce delay-100" />
            </div>
          ) : isCandidate ? (
            <Mic className="h-10 w-10 text-white animate-pulse" />
          ) : isDraining ? (
            <BrainCircuit className="h-10 w-10 text-white animate-pulse" />
          ) : (
            <div className="w-3 h-3 rounded-full bg-white/60 animate-ping" />
          )}
        </div>
      </div>

      {/* State badge below orb */}
      <div className="transition-all duration-300">
        {statusBadge}
      </div>
    </div>
  );
}
