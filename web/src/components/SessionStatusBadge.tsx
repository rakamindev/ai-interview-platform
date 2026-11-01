import { cn } from "@/lib/utils";
import type { Session } from "@/types";

type SessionStatus = Pick<Session, "status"> & { end_reason?: string | null };

function describe(session: SessionStatus) {
  if (session.status === "active")
    return { label: "Live", classes: "bg-rakamin-light-cyan text-rakamin-dark-teal", pulse: true };
  if (session.status === "ended" && session.end_reason === "error")
    return { label: "Failed", classes: "bg-destructive/10 text-destructive" };
  if (session.status === "ended")
    return { label: "Completed", classes: "bg-green-50 text-green-800" };
  return { label: "Awaiting candidate", classes: "bg-rakamin-yellow/25 text-rakamin-charcoal" };
}

export default function SessionStatusBadge({ session }: { session: SessionStatus }) {
  const { label, classes, pulse } = describe(session);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        classes,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full bg-current",
          pulse && "animate-pulse motion-reduce:animate-none",
        )}
      />
      {label}
    </span>
  );
}
