import { cn } from "@/lib/utils";
import { Sparkles, User, Info } from "lucide-react";

interface TranscriptBubbleProps {
  speaker: "candidate" | "assessor" | "system" | "ai";
  text: string;
}

export default function TranscriptBubble({ speaker, text }: TranscriptBubbleProps) {
  const isCandidate = speaker === "candidate";
  const isSystem = speaker === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
          <Info className="h-3.5 w-3.5 text-slate-400" />
          <span>{text}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 sm:gap-3 transition-all",
        isCandidate ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar Icon */}
      <div
        className={cn(
          "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs text-xs font-bold",
          isCandidate
            ? "bg-slate-800 text-white"
            : "bg-gradient-to-tr from-[#01959f] to-teal-400 text-white"
        )}
      >
        {isCandidate ? (
          <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        )}
      </div>

      {/* Bubble Container */}
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[80%] rounded-2xl p-3 sm:p-4 text-[13px] sm:text-[14px] leading-relaxed space-y-1 transition-all",
          isCandidate
            ? "bg-gradient-to-br from-teal-50/90 to-emerald-50/80 border border-teal-200/70 text-slate-900 rounded-tr-xs shadow-2xs"
            : "bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs shadow-2xs"
        )}
      >
        {/* Speaker Name / Tag */}
        <div
          className={cn(
            "flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider",
            isCandidate ? "text-teal-700" : "text-[#01959f]"
          )}
        >
          <span>{isCandidate ? "Anda (Kandidat)" : "Rakamin AI Assessor"}</span>
          <span
            className={cn(
              "px-1.5 py-0.2 rounded text-[9.5px] font-extrabold",
              isCandidate
                ? "bg-teal-100 text-teal-800"
                : "bg-teal-50 text-[#01959f] border border-teal-200"
            )}
          >
            {isCandidate ? "YOU" : "AI"}
          </span>
        </div>

        {/* Message Text */}
        <p className="whitespace-pre-wrap break-words text-slate-700 font-normal">
          {text}
        </p>
      </div>
    </div>
  );
}
