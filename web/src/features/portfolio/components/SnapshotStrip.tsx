import { useEffect, useState } from "react";
import { sessionsApi, type SessionSnapshot } from "@/shared/services/sessions";
import { formatDateTime } from "@/shared/lib/utils";
import { Camera } from "lucide-react";

export default function SnapshotStrip({ sessionId }: { sessionId: number }) {
  const [snapshots, setSnapshots] = useState<SessionSnapshot[]>([]);

  useEffect(() => {
    sessionsApi.getSnapshots(sessionId).then((res) => setSnapshots(res.data.snapshots)).catch(() => {});
  }, [sessionId]);

  if (snapshots.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold flex items-center gap-1.5">
        <Camera className="h-4 w-4" /> Proctoring Snapshots
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {snapshots.map((s) => (
          <img
            key={s.id}
            src={`data:image/jpeg;base64,${s.image_data}`}
            alt={`Snapshot at ${formatDateTime(s.captured_at)}`}
            title={formatDateTime(s.captured_at) ?? undefined}
            className="h-20 w-28 object-cover rounded-md border shrink-0"
          />
        ))}
      </div>
    </div>
  );
}
