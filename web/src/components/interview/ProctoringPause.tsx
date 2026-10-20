import { Camera, Monitor, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProctoringPauseProps {
  camera: boolean; // the camera stopped
  screen: boolean; // the screen share stopped
  secondScreen: boolean; // a second screen is connected
  busy: boolean;
  error: string | null;
  onResumeCamera: () => void;
  onResumeScreen: () => void;
}

function stoppedSentence(camera: boolean, screen: boolean): string | null {
  if (camera && screen) return "Your camera and screen sharing stopped. Your microphone is off until you turn them back on.";
  if (camera) return "Your camera stopped. Your microphone is off until you turn it back on.";
  if (screen) return "Your screen sharing stopped. Your microphone is off until you turn it back on.";
  return null;
}

/**
 * Covers the interview while the camera or the screen share is off, or a second screen is connected; the timer keeps
 * running underneath. A second screen has no button: the interview carries on by itself once it's disconnected.
 */
export default function ProctoringPause({ camera, screen, secondScreen, busy, error, onResumeCamera, onResumeScreen }: ProctoringPauseProps) {
  const stopped = stoppedSentence(camera, screen);
  let extra: string | null = null;
  if (secondScreen) {
    extra = stopped
      ? "A second screen is also connected: disconnect it too."
      : "A second screen is connected. Your microphone is off until you disconnect it, and the interview carries on by itself.";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="alertdialog" aria-modal="true" aria-labelledby="pause-title" aria-describedby="pause-body"
        className="w-full max-w-sm space-y-4 rounded-2xl bg-background p-6 text-center shadow-xl">
        <PauseCircle className="mx-auto h-10 w-10 text-amber-500" />
        <div className="space-y-1.5">
          <h2 id="pause-title" className="text-lg font-semibold">Interview paused</h2>
          <p id="pause-body" className="text-sm text-muted-foreground">
            {[stopped, extra, "The timer keeps running."].filter(Boolean).join(" ")}
          </p>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-col gap-2">
          {camera && (
            <Button onClick={onResumeCamera} disabled={busy}>
              <Camera className="mr-2 h-4 w-4" /> Turn camera back on
            </Button>
          )}
          {screen && (
            <Button onClick={onResumeScreen} disabled={busy} variant={camera ? "outline" : "default"}>
              <Monitor className="mr-2 h-4 w-4" /> Share your entire screen again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
