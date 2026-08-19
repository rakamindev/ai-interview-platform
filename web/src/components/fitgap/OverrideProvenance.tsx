import { Pencil } from "lucide-react";

interface OverrideProvenanceProps {
  actor?: string;
  reason?: string;
  at?: string;
}

export default function OverrideProvenance({ actor, reason, at }: OverrideProvenanceProps) {
  if (!actor && !reason && !at) return null;

  const formattedTime = at
    ? new Date(at).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : null;

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      title={reason ?? undefined}
    >
      <Pencil className="h-3 w-3" />
      {actor && <span>{actor}</span>}
      {formattedTime && <span>({formattedTime})</span>}
    </span>
  );
}
