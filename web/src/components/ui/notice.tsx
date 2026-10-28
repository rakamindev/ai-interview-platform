import * as React from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  info: { icon: Info, className: "bg-muted/60 border-border text-foreground" },
  warning: { icon: AlertTriangle, className: "bg-amber-50 border-amber-200 text-amber-900" },
  error: { icon: AlertCircle, className: "bg-destructive/5 border-destructive/30 text-destructive" },
};

interface NoticeProps {
  tone?: keyof typeof tones;
  children: React.ReactNode;
  /** A button or link shown at the end, e.g. Retry. */
  action?: React.ReactNode;
  className?: string;
}

export function Notice({ tone = "info", children, action, className }: NoticeProps) {
  const { icon: Icon, className: toneClass } = tones[tone];

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex flex-wrap items-start gap-2 rounded-md border px-3 py-2 text-sm", toneClass, className)}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
      <div className="flex-1 min-w-[12rem]">{children}</div>
      {action}
    </div>
  );
}
