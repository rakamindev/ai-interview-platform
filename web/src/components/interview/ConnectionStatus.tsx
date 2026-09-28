import { Loader2 } from "lucide-react";

interface ConnectionStatusProps {
  state: "connected" | "reconnecting" | "lost";
}

export default function ConnectionStatus({ state }: ConnectionStatusProps) {
  if (state === "connected") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        Connected
      </div>
    );
  }
  if (state === "reconnecting") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-warning">
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
