import type { FitGapSnapshot } from "@/types";

interface FitGapHistorySidebarProps {
  history: FitGapSnapshot[];
  activeSnapshotId: number | null;
  onSelectSnapshot: (snapshot: FitGapSnapshot) => void;
}

export default function FitGapHistorySidebar({
  history,
  activeSnapshotId,
  onSelectSnapshot,
}: FitGapHistorySidebarProps) {
  return (
    <div className="w-64 border-r bg-muted/10 h-full p-4 space-y-4 shrink-0">
      <div>
        <h3 className="text-sm font-semibold">Analysis History</h3>
        <p className="text-xs text-muted-foreground">Historical snapshots for this candidate</p>
      </div>

      <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-12rem)]">
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No past snapshots recorded.</p>
        ) : (
          history.map((snapshot) => {
            const isActive = snapshot.id === activeSnapshotId;
            const dateStr = new Date(snapshot.generated_at).toLocaleDateString("id-ID", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <button
                key={snapshot.id}
                type="button"
                onClick={() => onSelectSnapshot(snapshot)}
                className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all flex flex-col gap-1 ${
                  isActive ? "bg-primary/5 border-primary shadow-sm" : "bg-white hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between font-medium">
                  <span className="truncate max-w-[120px]">{snapshot.vacancy_title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{dateStr}</span>
                </div>
                <div className="text-[10px] text-muted-foreground capitalize">
                  Reason: {snapshot.trigger_reason.replace(/_/g, " ")}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
