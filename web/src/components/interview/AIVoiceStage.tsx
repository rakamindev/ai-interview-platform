import { cn } from "@/lib/utils";
import { Sparkles, Mic, Volume2, ShieldCheck, Activity } from "lucide-react";

interface AIVoiceStageProps {
  speaker: "ai" | "candidate" | null;
  interviewState: string;
  roleTitle?: string;
  micMuted?: boolean;
}

export default function AIVoiceStage({
  speaker,
  interviewState,
  roleTitle,
  micMuted = false,
}: AIVoiceStageProps) {
  const isAiSpeaking = speaker === "ai";
  const isCandidateSpeaking = speaker === "candidate";
  const isConnecting = interviewState === "connecting";
  const isDraining = interviewState === "draining_audio";

  return (
    <div className="relative w-full rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white p-6 sm:p-8 flex flex-col items-center justify-between overflow-hidden shadow-xl border border-slate-800/80 min-h-[340px] sm:min-h-[420px] lg:min-h-[480px]">
      {/* Background ambient glowing mesh */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={cn(
            "absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl transition-opacity duration-700",
            isAiSpeaking
              ? "bg-[#01959f]/30 opacity-100"
              : isCandidateSpeaking
              ? "bg-emerald-500/25 opacity-100"
              : "bg-teal-500/10 opacity-60"
          )}
        />
        <div className="absolute -bottom-24 right-10 w-60 h-60 rounded-full bg-[#fbc036]/10 blur-2xl" />
        {/* Subtle grid texture */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
      </div>

      {/* Top Stage Header: Role & Session Protocol */}
      <div className="relative z-10 w-full flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="font-semibold text-slate-300 tracking-wide uppercase text-[11px] truncate">
            {roleTitle ? `${roleTitle}` : "AI Technical Interview"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400 bg-slate-800/70 border border-slate-700/60 rounded-full px-2.5 py-1 text-[11px] shrink-0 whitespace-nowrap">
          <ShieldCheck className="h-3 w-3 text-teal-400 shrink-0" />
          <span className="whitespace-nowrap">Verbatim AI Signal</span>
        </div>
      </div>

      {/* Center Holographic Acoustic Orb */}
      <div className="relative z-10 my-auto py-6 sm:py-8 flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          {/* Animated concentric pulse rings when speaking */}
          {(isAiSpeaking || isCandidateSpeaking) && (
            <>
              <div
                className={cn(
                  "absolute inset-0 rounded-full scale-150 animate-ping opacity-25 pointer-events-none duration-1000",
                  isAiSpeaking ? "bg-[#01959f]" : "bg-emerald-500"
                )}
              />
              <div
                className={cn(
                  "absolute -inset-4 rounded-full border opacity-40 animate-pulse pointer-events-none",
                  isAiSpeaking ? "border-teal-400" : "border-emerald-400"
                )}
              />
            </>
          )}

          {/* Core Orb Container */}
          <div
            className={cn(
              "w-28 h-28 sm:w-36 sm:h-36 rounded-full flex items-center justify-center relative shadow-2xl transition-all duration-500",
              isAiSpeaking
                ? "bg-gradient-to-tr from-[#01959f] via-teal-400 to-cyan-300 shadow-[#01959f]/40 scale-105"
                : isCandidateSpeaking
                ? "bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 shadow-emerald-500/30 scale-102"
                : "bg-gradient-to-tr from-slate-800 via-slate-800 to-slate-700 shadow-black/40 border border-slate-700/80"
            )}
          >
            {/* Dynamic Equalizer Bars inside Orb */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 h-14 sm:h-16">
              {Array.from({ length: 7 }).map((_, i) => {
                const heights = [
                  "h-3 group-hover:h-8",
                  "h-6",
                  "h-10",
                  "h-14",
                  "h-10",
                  "h-6",
                  "h-3",
                ];
                return (
                  <div
                    key={i}
                    className={cn(
                      "w-1 sm:w-1.5 rounded-full transition-all duration-200",
                      isAiSpeaking || isCandidateSpeaking
                        ? "bg-white animate-voice-bar shadow-xs"
                        : isConnecting
                        ? "bg-teal-400/50 h-3 animate-pulse"
                        : "bg-slate-500/40 h-2"
                    )}
                    style={{
                      animationDelay: `${i * 0.12}s`,
                      animationDuration: isAiSpeaking ? "0.65s" : "0.9s",
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Dynamic Status Capsule Badge */}
        <div className="mt-6 flex flex-col items-center gap-1.5">
          {isConnecting ? (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 text-teal-300 text-xs font-semibold animate-pulse">
              <Activity className="h-3.5 w-3.5 animate-spin" />
              Connecting (Menghubungkan ke Gemini Live...)
            </div>
          ) : isDraining ? (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 text-teal-300 text-xs font-semibold">
              <Volume2 className="h-3.5 w-3.5 animate-bounce" />
              Wrapping up (Menyelesaikan respons audio...)
            </div>
          ) : isAiSpeaking ? (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#01959f]/20 border border-[#01959f]/40 text-teal-300 text-xs font-bold shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-teal-300 animate-spin-slow" />
              AI Sedang Berbicara (AI speaking)
            </div>
          ) : isCandidateSpeaking ? (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-sm">
              <Mic className="h-3.5 w-3.5 text-emerald-300 animate-pulse" />
              Mendengarkan Suara Anda (Listening...)
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-teal-400/80 animate-ping" />
              AI Siap Mendengarkan (Listening...)
            </div>
          )}
          <span className="text-[11px] text-slate-400 font-normal">
            {isAiSpeaking
              ? "Dengarkan pertanyaan atau klarifikasi teknis AI"
              : isCandidateSpeaking
              ? "Suara Anda sedang diproses oleh AI secara real-time"
              : "Silakan bicara langsung melalui mikrofon Anda"}
          </span>
        </div>
      </div>

      {/* Bottom Stage Footer: Audio Status Indicator */}
      <div className="relative z-10 w-full pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              micMuted ? "bg-rose-500" : "bg-emerald-400 animate-pulse"
            )}
          />
          <span className="text-[11.5px] font-medium text-slate-300">
            {micMuted ? "Mikrofon Dinonaktifkan (Muted)" : "Input Mikrofon Aktif & Jernih"}
          </span>
        </div>
        <span className="text-[11px] text-slate-500 hidden sm:inline">
          Real-time Latency ~250ms
        </span>
      </div>
    </div>
  );
}
