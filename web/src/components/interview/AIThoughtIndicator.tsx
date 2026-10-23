import React from "react";
import { Sparkles, Mic, Volume2, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

export type AIInteractionStatus = "listening" | "thinking" | "speaking" | "idle";

interface AIThoughtIndicatorProps {
  status: AIInteractionStatus;
  className?: string;
}

export const AIThoughtIndicator: React.FC<AIThoughtIndicatorProps> = ({ status, className }) => {
  const config = {
    listening: {
      label: "Mendengarkan Jawaban Anda...",
      containerClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]",
      dotClass: "bg-emerald-500 animate-ping",
      icon: <Mic className="w-4 h-4 animate-pulse text-emerald-600 dark:text-emerald-400" />,
    },
    thinking: {
      label: "AI Sedang Menganalisis Konteks...",
      containerClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.15)]",
      dotClass: "bg-amber-500 animate-pulse",
      icon: <Sparkles className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400" />,
    },
    speaking: {
      label: "AI Sedang Menyampaikan Pertanyaan...",
      containerClass: "border-primary/30 bg-primary/10 text-primary shadow-[0_0_15px_rgba(1,149,159,0.15)]",
      dotClass: "bg-primary animate-bounce",
      icon: <Volume2 className="w-4 h-4 animate-pulse text-primary" />,
    },
    idle: {
      label: "Sesi Wawancara Siap",
      containerClass: "border-border bg-muted/50 text-muted-foreground",
      dotClass: "bg-muted-foreground",
      icon: <Radio className="w-4 h-4 text-muted-foreground" />,
    },
  }[status];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 px-4 py-2 rounded-full border text-xs font-semibold backdrop-blur-md transition-all duration-300 shadow-sm",
        config.containerClass,
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75", config.dotClass)} />
        <span className={cn("relative inline-flex rounded-full h-2 w-2", config.dotClass.split(" ")[0])} />
      </span>
      {config.icon}
      <span className="tracking-wide font-medium">{config.label}</span>
    </div>
  );
};

export default AIThoughtIndicator;
