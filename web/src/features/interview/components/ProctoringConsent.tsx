import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Camera } from "lucide-react";

export default function ProctoringConsent({ onAgree }: { onAgree: () => void }) {
  const [declined, setDeclined] = useState(false);

  if (declined) {
    return (
      <div className="text-sm text-muted-foreground text-center space-y-2 py-4">
        <p>This interview format requires webcam snapshots to proceed.</p>
        <p>Please contact the hiring team if you'd like to discuss alternative arrangements.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1.5 text-muted-foreground">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <Camera className="h-4 w-4" /> Periodic webcam snapshots
        </p>
        <p>Purpose: a still photo is captured from your webcam every few minutes, to help verify identity and deter impersonation.</p>
        <p>Access: only visible to the hiring team reviewing your results.</p>
        <p>Retention: snapshots are deleted 90 days after capture, or immediately if your candidate record is deleted.</p>
        <p>You can withdraw this consent at any time by contacting the hiring team.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setDeclined(true)}>
          I don't agree
        </Button>
        <Button className="flex-1" onClick={onAgree}>
          I agree — continue
        </Button>
      </div>
    </div>
  );
}
