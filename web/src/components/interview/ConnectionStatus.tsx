import { Loader2, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  state: "connected" | "reconnecting" | "lost";
  className?: string;
}

export default function ConnectionStatus({ state, className }: ConnectionStatusProps) {
  if (state === "connected") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-semibold shadow-2xs",
          className
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="hidden sm:inline">Terhubung:</span>
        <span>Gemini Live</span>
      </div>
    );
  }

  if (state === "reconnecting") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-xs font-semibold animate-pulse shadow-2xs",
          className
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
        <span>Menghubungkan Ulang...</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-300 text-xs font-semibold shadow-2xs",
        className
      )}
    >
      <WifiOff className="h-3 w-3 text-rose-600" />
      <span>Koneksi Terputus</span>
    </div>
  );
}
