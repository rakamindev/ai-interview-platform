import { Bot, User, Mic } from "lucide-react";
import type { InterviewSpeaker } from "@/types";

interface VoiceActivityHaloProps {
  speaker: InterviewSpeaker;
  label?: string;
}

export default function VoiceActivityHalo({ speaker, label }: VoiceActivityHaloProps) {
  const isAi = speaker === "ai";
  const isCandidate = speaker === "candidate";

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-4">
      {/* Halo container */}
      <div className="relative flex items-center justify-center w-36 h-36">
        {/* Outer concentric pulse ring 2 */}
        {(isAi || isCandidate) && (
          <div
            className={`absolute inset-0 rounded-full opacity-25 animate-ping duration-1000 ${
              isAi ? "bg-indigo-500" : "bg-emerald-500"
            }`}
          />
        )}

        {/* Outer concentric pulse ring 1 */}
        <div
          className={`absolute -inset-3 rounded-full transition-all duration-300 ${
            isAi
              ? "bg-indigo-400/20 ring-4 ring-indigo-400/30 scale-105"
              : isCandidate
              ? "bg-emerald-400/20 ring-4 ring-emerald-400/30 scale-105"
              : "bg-muted/40 ring-1 ring-border"
          }`}
        />

        {/* Inner core circle */}
        <div
          className={`relative z-10 flex items-center justify-center w-28 h-28 rounded-full shadow-md transition-colors duration-300 ${
            isAi
              ? "bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-indigo-200"
              : isCandidate
              ? "bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-emerald-200"
              : "bg-background border-2 border-border text-muted-foreground"
          }`}
        >
          {isAi ? (
            <Bot className="w-12 h-12 animate-pulse" />
          ) : isCandidate ? (
            <User className="w-12 h-12 animate-pulse" />
          ) : (
            <Mic className="w-10 h-10 text-muted-foreground/60" />
          )}
        </div>
      </div>

      {/* Speaker status indicator */}
      <div className="text-center">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium tracking-wide transition-colors ${
            isAi
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
              : isCandidate
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isAi
                ? "bg-indigo-600 animate-pulse"
                : isCandidate
                ? "bg-emerald-600 animate-pulse"
                : "bg-muted-foreground/40"
            }`}
          />
          {label || (isAi ? "AI Speaking" : isCandidate ? "You're Speaking" : "Listening...")}
        </span>
      </div>
    </div>
  );
}
