import { Loader2 } from "lucide-react";

interface ConnectionStatusProps {
  state: "connected" | "reconnecting" | "lost";
}

export default function ConnectionStatus({ state }: ConnectionStatusProps) {
  if (state === "connected") {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800">
        <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
        Connected
      </div>
    );
  }
  if (state === "reconnecting") {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-rakamin-yellow/25 px-2.5 py-1 text-xs font-medium text-rakamin-charcoal">
        <Loader2 className="h-3 w-3 animate-spin" />
        Reconnecting...
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
      <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
      Connection lost
    </div>
  );
}
