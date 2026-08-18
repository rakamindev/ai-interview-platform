import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Assessment } from "@/types";

const toneClass = {
  live: "bg-primary/10 text-primary border-primary/20",
  awaiting: "bg-amber-50 text-amber-800 border-amber-200",
  completed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  muted: "bg-muted text-muted-foreground border-transparent",
} as const;

export function StatusPill({
  tone = "muted",
  pulse,
  children,
  className,
}: {
  tone?: keyof typeof toneClass;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        toneClass[tone],
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}

export function SessionStatusPill({
  session,
}: {
  session?: Assessment["latest_session"];
}) {
  if (!session) {
    return <StatusPill tone="muted">No session yet</StatusPill>;
  }

  if (session.status === "active") {
    return (
      <StatusPill tone="live" pulse>
        Live now
      </StatusPill>
    );
  }

  if (session.status === "ended" && session.end_reason === "error") {
    return <StatusPill tone="failed">Last failed</StatusPill>;
  }

  if (session.status === "ended") {
    return <StatusPill tone="completed">Completed</StatusPill>;
  }

  return <StatusPill tone="awaiting">Awaiting candidate</StatusPill>;
}
