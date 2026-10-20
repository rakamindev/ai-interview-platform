import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatePanelProps {
  title: string;
  body: string;
  icon?: ReactNode;
  tone?: "neutral" | "error";
  children?: ReactNode;
}

/** Centered panel for loading, empty, waiting and error states: what happened, then what to do. */
export default function StatePanel({ title, body, icon, tone = "neutral", children }: StatePanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border px-6 py-10 text-center",
        tone === "error" && "border-destructive/40",
      )}
    >
      {icon}
      <div className="space-y-1">
        <p className={cn("font-medium", tone === "error" && "text-destructive")}>{title}</p>
        <p className="max-w-md break-words text-sm text-muted-foreground">{body}</p>
      </div>
      {children}
    </div>
  );
}
