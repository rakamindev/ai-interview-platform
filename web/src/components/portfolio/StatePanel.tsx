import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatePanelProps {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "error";
}

/** Centered panel for page-level loading, empty and error states. */
export default function StatePanel({ icon, title, children, action, tone = "neutral" }: StatePanelProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border px-6 py-10 text-center sm:py-12",
        tone === "error" ? "border-destructive/30 bg-destructive/5" : "bg-card"
      )}
    >
      <div className={tone === "error" ? "text-destructive" : "text-primary"}>{icon}</div>
      <div className="max-w-md space-y-1">
        <p className="font-medium">{title}</p>
        {children && <div className="text-sm text-muted-foreground">{children}</div>}
      </div>
      {action}
    </div>
  );
}
