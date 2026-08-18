import { cn } from "@/lib/utils";

interface TranscriptBubbleProps {
  speaker: "candidate" | "assessor" | "system" | "ai";
  text: string;
}

export default function TranscriptBubble({ speaker, text }: TranscriptBubbleProps) {
  const isCandidate = speaker === "candidate";

  return (
    <div className={cn("flex", isCandidate ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-xs font-medium border shadow-md",
          isCandidate
            ? "bg-teal-500/20 text-slate-100 border-teal-500/40"
            : "bg-slate-900 text-slate-100 border-slate-800"
        )}
      >
        <span className={cn("block text-[11px] font-bold mb-1 tracking-wide uppercase", isCandidate ? "text-teal-300" : "text-cyan-300")}>
          {isCandidate ? "👨‍💻 You" : "🤖 Rakamin AI"}
        </span>
        <p className="leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

