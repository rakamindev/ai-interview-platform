import { Loader2 } from "lucide-react";

interface ConnectionStatusProps {
  state: "connected" | "reconnecting" | "lost";
}

const COPY = {
  connected: "Connected",
  reconnecting: "Reconnecting…",
  lost: "Connection lost",
} as const;

/** Uses the semantic status tokens so it reads the same in light and dark. */
export default function ConnectionStatus({ state }: ConnectionStatusProps) {
  if (state === "reconnecting") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-warning" role="status">
        <Loader2 className="h-3 w-3 animate-spin motion-safe-only" aria-hidden="true" />
        {COPY.reconnecting}
      </div>
    );
  }

  const isLost = state === "lost";

  return (
    <div
      className={`flex items-center gap-1.5 text-xs ${isLost ? "text-destructive" : "text-success"}`}
      role="status"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isLost ? "bg-destructive" : "bg-success"}`}
        aria-hidden="true"
      />
      {isLost ? COPY.lost : COPY.connected}
    </div>
  );
}
