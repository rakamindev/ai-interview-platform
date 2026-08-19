import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";

interface TranscriptBubbleProps {
  speaker: "candidate" | "assessor" | "system" | "ai";
  text: string;
}

export default function TranscriptBubble({ speaker, text }: TranscriptBubbleProps) {
  const isCandidate = speaker === "candidate";

  return (
    <div className={cn("flex w-full mb-4", isCandidate ? "justify-end" : "justify-start")}>
      <div className={cn("flex max-w-[85%] items-end gap-2", isCandidate ? "flex-row-reverse" : "flex-row")}>
        {/* Avatar */}
        <div className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
          isCandidate ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"
        )}>
          {isCandidate ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-muted-foreground" />}
        </div>
        
        {/* Bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-[15px] shadow-sm leading-relaxed",
            isCandidate
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-white dark:bg-zinc-800 border text-foreground rounded-bl-sm"
          )}
        >
          {text}
        </div>
      </div>
    </div>
  );
}
