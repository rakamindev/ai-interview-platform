import { Bot, User } from "lucide-react";

interface LiveCaptionsOverlayProps {
  latestTurn?: { speaker: string; text: string } | null;
  enabled?: boolean;
}

export default function LiveCaptionsOverlay({
  latestTurn,
  enabled = true,
}: LiveCaptionsOverlayProps) {
  if (!enabled || !latestTurn || !latestTurn.text.trim()) {
    return null;
  }

  const isAi = latestTurn.speaker === "ai";

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-2 transition-all duration-200">
      <div className="flex items-start gap-2.5 px-4 py-2.5 rounded-xl bg-background/95 backdrop-blur border shadow-sm text-sm">
        <span
          className={`shrink-0 inline-flex items-center gap-1 font-semibold text-xs mt-0.5 ${
            isAi ? "text-indigo-600" : "text-emerald-600"
          }`}
        >
          {isAi ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
          {isAi ? "AI:" : "You:"}
        </span>
        <p className="flex-1 text-foreground text-xs leading-relaxed line-clamp-3">
          {latestTurn.text}
        </p>
      </div>
    </div>
  );
}
