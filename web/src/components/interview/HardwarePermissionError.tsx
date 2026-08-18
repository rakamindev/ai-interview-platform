import { Button } from "@/components/ui/button";
import { MicOff, RefreshCw } from "lucide-react";
import type { MediaAccessError } from "@/utils/hardwareUtils";

interface HardwarePermissionErrorProps {
  reason: MediaAccessError;
  onRetry: () => void;
}

const MESSAGES: Record<MediaAccessError, { title: string; description: string }> = {
  permission_denied: {
    title: "Microphone access blocked",
    description:
      "Your browser blocked access to the microphone. Click the camera/lock icon in the address bar, allow microphone access, then retry.",
  },
  not_found: {
    title: "No microphone detected",
    description:
      "We couldn't find a working microphone on this device. Connect a microphone and retry.",
  },
  not_readable: {
    title: "Microphone unavailable",
    description:
      "Your microphone is being used by another application. Close it and retry.",
  },
  unknown: {
    title: "Couldn't access your microphone",
    description: "Something went wrong while requesting microphone access. Please retry.",
  },
};

export default function HardwarePermissionError({ reason, onRetry }: HardwarePermissionErrorProps) {
  const { title, description } = MESSAGES[reason];

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
      <MicOff className="h-8 w-8 mx-auto text-destructive" />
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Retry
      </Button>
    </div>
  );
}
