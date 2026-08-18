import { Loader2 } from "lucide-react";

interface ConnectionStatusProps {
  state: "connected" | "reconnecting" | "lost";
}

export default function ConnectionStatus({ state }: ConnectionStatusProps) {
  if (state === "connected") {
    return (
      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        Connected
      </div>
    );
  }
  if (state === "reconnecting") {
    return (
      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
        Reconnecting...
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
      <span className="h-2 w-2 rounded-full bg-rose-500" />
      Connection Lost
    </div>
  );
}

