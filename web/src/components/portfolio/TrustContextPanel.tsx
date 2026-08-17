import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Wifi, AudioLines, RefreshCw, Clock } from "lucide-react";
import type { IntegrityMetadata } from "@/types";

interface TrustContextPanelProps {
  integrity?: IntegrityMetadata;
  durationSeconds?: number;
  endReason?: string;
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function TrustContextPanel({
  integrity,
  durationSeconds,
  endReason,
}: TrustContextPanelProps) {
  const hasAny = integrity && Object.keys(integrity).length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-teal-600" /> Session trust & context
        </CardTitle>
        <CardDescription>
          Transparent context about how this interview was captured — no judgment, just signals.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          <div>
            <p className="text-xs uppercase tracking-wide">Duration</p>
            <p className="font-medium text-foreground">{formatDuration(durationSeconds)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 shrink-0" />
          <div>
            <p className="text-xs uppercase tracking-wide">End reason</p>
            <p className="font-medium text-foreground">
              {endReason ? endReason.replace(/_/g, " ") : "—"}
            </p>
          </div>
        </div>

        {hasAny ? (
          <>
            <div className="flex items-center gap-2 text-muted-foreground">
              <AudioLines className="h-4 w-4 shrink-0" />
              <div>
                <p className="text-xs uppercase tracking-wide">Device</p>
                <p className="font-medium text-foreground">{integrity?.device_state ?? "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <Wifi className="h-4 w-4 shrink-0" />
              <div>
                <p className="text-xs uppercase tracking-wide">Connection</p>
                <p className="font-medium text-foreground">
                  {integrity?.connection_health ?? "—"}
                </p>
              </div>
            </div>

            <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 shrink-0" />
              <div>
                <p className="text-xs uppercase tracking-wide">Reconnects</p>
                <p className="font-medium text-foreground">
                  {typeof integrity?.reconnect_events === "number"
                    ? integrity.reconnect_events === 0
                      ? "None — stable throughout"
                      : `${integrity.reconnect_events} event(s)`
                    : "—"}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="col-span-2">
            <Badge variant="secondary">No integrity signals recorded</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}