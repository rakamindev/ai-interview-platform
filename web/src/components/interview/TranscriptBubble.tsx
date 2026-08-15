import { cn } from "@/lib/utils";
import { User, Sparkles } from "lucide-react";

interface TranscriptBubbleProps {
  speaker: "candidate" | "assessor" | "system" | "ai";
  text: string;
}

function cleanTranscriptText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/^[\s,\[\]\{\}'"\\`\n:\-]+/, "")
    .replace(/\[COVERAGE[_ ]MAP\][\s\S]*?\[\/COVERAGE[_ ]MAP\]/gi, "")
    .replace(/\[COVERAGE[_ ]MAP[^\]]*\]/gi, "")
    .replace(/\[TIME[_ ]CONTROL[^\]]*\][^\n]*/gi, "")
    .replace(/^[\s,\[\]\{\}'"\\`\n:\-]+/, "")
    .trim();
}

export default function TranscriptBubble({ speaker, text }: TranscriptBubbleProps) {
  const isCandidate = speaker === "candidate";
  const displayText = cleanTranscriptText(text);

  if (!displayText) return null;

  return (
    <div className={cn("flex items-start gap-2", isCandidate ? "justify-end" : "justify-start")}>
      {!isCandidate && (
        <div className="h-7 w-7 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-2xs",
          isCandidate
            ? "bg-slate-900 text-white rounded-tr-xs"
            : "bg-slate-100 text-slate-800 border border-slate-200/80 rounded-tl-xs"
        )}
      >
        <span className={cn("block text-[10px] font-bold uppercase tracking-wider mb-1", isCandidate ? "text-slate-300" : "text-primary")}>
          {isCandidate ? "You" : "Rakamin AI"}
        </span>
        <p className="whitespace-pre-wrap">{displayText}</p>
      </div>

      {isCandidate && (
        <div className="h-7 w-7 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
          <User className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}
