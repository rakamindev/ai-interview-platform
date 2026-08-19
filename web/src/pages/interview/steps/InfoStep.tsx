import { Button } from "@/components/ui/button";
import { Wifi, Clock, Mic } from "lucide-react";
import type { CandidateInfo } from "@/types";

export default function InfoStep({ candidateInfo, onContinue }: {
  candidateInfo: CandidateInfo | null;
  onContinue: () => void;
}) {
  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-semibold">{candidateInfo?.role_title ?? "AI Interview"}</h1>
        {candidateInfo && (
          <p className="text-sm text-muted-foreground">{candidateInfo.time_limit_min} minutes</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3 border rounded-lg p-3">
          <Mic className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            This is a voice interview with an AI interviewer. There's no script — it'll ask
            follow-up questions based on what you say. Find a quiet place before you start.
          </p>
        </div>
        <div className="flex items-start gap-3 border rounded-lg p-3">
          <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            The session lasts up to {candidateInfo?.time_limit_min ?? "—"} minutes. You can end it
            early if you need to.
          </p>
        </div>
        <div className="flex items-start gap-3 border rounded-lg p-3">
          <Wifi className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            A stable internet connection matters — we'll check yours in a moment, along with your
            microphone and audio.
          </p>
        </div>
      </div>

      <Button className="w-full" size="lg" onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}
