import React from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import { ProctoringState } from "@/utils/hardwareUtils";

interface StatusIndicatorProps {
  state: ProctoringState;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ state }) => {
  if (state === ProctoringState.LOADING) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-primary font-medium">{m.hardware_checking()}</span>
      </div>
    );
  }
  if (state === ProctoringState.PASSED) {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-green-600" />
        <span className="text-green-600 font-medium">{m.hardware_passed()}</span>
      </div>
    );
  }
  if (state === ProctoringState.ERROR) {
    return (
      <div className="flex items-center gap-2">
        <XCircle className="w-5 h-5 text-destructive" />
        <span className="text-destructive font-medium">{m.hardware_failed()}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 bg-muted rounded-full" />
      <span className="text-muted-foreground font-medium">{m.hardware_waiting()}</span>
    </div>
  );
};

export default StatusIndicator;
