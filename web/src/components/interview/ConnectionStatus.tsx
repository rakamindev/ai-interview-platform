import { Loader2 } from "lucide-react";

interface ConnectionStatusProps {
  state: "connecting" | "connected" | "reconnecting" | "lost";
}

export default function ConnectionStatus({ state }: ConnectionStatusProps) {
  if (state === "connecting") {
    return (
      <div role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Connecting...
      </div>
    );
  }
  if (state === "connected") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Connected
      </div>
    );
  }
  if (state === "reconnecting") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-800">
        <Loader2 className="h-3 w-3 animate-spin" />
        Reconnecting...
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs text-destructive">
      <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
      Connection lost
    </div>
  );
}
