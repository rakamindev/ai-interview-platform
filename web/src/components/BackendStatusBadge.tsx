import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useBackendStatus,
  type BackendStatus,
} from "@/hooks/useBackendStatus";
import { RotateCw } from "lucide-react";

const STATUS_CONFIG: Record<
  BackendStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  checking: {
    label: "Checking…",
    badgeClass: "border-transparent bg-secondary text-muted-foreground",
    dotClass: "bg-muted-foreground animate-pulse",
  },
  online: {
    label: "Backend online",
    badgeClass: "border-transparent bg-green-500/10 text-green-600",
    dotClass: "bg-green-500",
  },
  offline: {
    label: "Backend offline",
    badgeClass: "border-transparent bg-destructive/10 text-destructive",
    dotClass: "bg-destructive",
  },
};

export default function BackendStatusBadge() {
  const { status, recheck } = useBackendStatus();
  const config = STATUS_CONFIG[status];

  return (
    <div className="fixed right-4 top-4 z-50">
      <Badge className={cn(config.badgeClass, "gap-1.5")}>
        <span
          className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)}
          aria-hidden="true"
        />
        {config.label}
        {status === "offline" && (
          <button
            type="button"
            aria-label="Retry backend check"
            onClick={recheck}
            className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/15"
          >
            <RotateCw className="h-3 w-3" />
          </button>
        )}
      </Badge>
    </div>
  );
}