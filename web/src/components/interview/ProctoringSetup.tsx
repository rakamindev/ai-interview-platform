import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle, Monitor, MonitorX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CAMERA_ERROR, SCREEN_SHARE_ERRORS, requestCamera, requestEntireScreen } from "@/utils/proctoring";

interface ProctoringSetupProps {
  camera: MediaStream | null;
  screen: MediaStream | null;
  secondScreen: boolean; // Chrome sees more than one screen
  acknowledged: boolean;
  onCamera: (stream: MediaStream | null) => void;
  onScreen: (stream: MediaStream | null) => void;
  onAcknowledge: (value: boolean) => void;
}


/** Camera, entire-screen share, one screen and the notice, for assessments that require them. Nothing here is recorded. */
export default function ProctoringSetup({ camera, screen, secondScreen, acknowledged, onCamera, onScreen, onAcknowledge }: ProctoringSetupProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"camera" | "screen" | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = camera;
  }, [camera]);

  // Stopping either from Chrome's own controls before the interview starts puts the step back to "off".
  useEffect(() => {
    const track = screen?.getVideoTracks()[0];
    if (!track) return;
    const ended = () => onScreen(null);
    track.addEventListener("ended", ended);
    return () => track.removeEventListener("ended", ended);
  }, [screen, onScreen]);

  useEffect(() => {
    const track = camera?.getVideoTracks()[0];
    if (!track) return;
    const ended = () => onCamera(null);
    track.addEventListener("ended", ended);
    return () => track.removeEventListener("ended", ended);
  }, [camera, onCamera]);

  const turnOnCamera = async () => {
    setBusy("camera");
    setCameraError(null);
    const stream = await requestCamera();
    setBusy(null);
    if (stream) onCamera(stream);
    else setCameraError(CAMERA_ERROR);
  };

  const shareScreen = async () => {
    setBusy("screen");
    setScreenError(null);
    const result = await requestEntireScreen();
    setBusy(null);
    if (result.ok) {
      screen?.getTracks().forEach((t) => t.stop());
      onScreen(result.stream);
    } else {
      setScreenError(SCREEN_SHARE_ERRORS[result.reason]);
    }
  };

  return (
    <section aria-labelledby="proctoring-heading" className="overflow-hidden rounded-lg border bg-card">
      <div className="space-y-2 border-b bg-[hsl(var(--primary-deep))] px-4 py-4 text-white">
        <h2 id="proctoring-heading" className="font-semibold">Camera and screen sharing</h2>
        <ul className="list-disc space-y-1.5 pl-4 text-sm text-white/85 marker:text-secondary">
          <li>Keep your camera on and your entire screen shared until the interview ends.</li>
          <li>When Chrome asks what to share, choose <strong className="text-white">Entire screen</strong>, not a tab or a window.</li>
          <li>Use one screen: disconnect any second monitor before you start.</li>
          <li>If your camera or screen sharing stops, or a second screen is connected, the interview pauses until that's put right.</li>
          <li>The interview only checks these three things. Your camera and screen are not recorded or stored.</li>
        </ul>
      </div>

      <div className="divide-y">
        <div className="flex items-start gap-3 px-4 py-3">
          <Camera className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Camera</p>
            {camera ? (
              <video ref={previewRef} autoPlay muted playsInline aria-label="Your camera"
                className="mt-2 aspect-video w-40 rounded-md bg-black object-cover" />
            ) : (
              cameraError && <p role="alert" className="mt-1 text-sm text-destructive">{cameraError}</p>
            )}
          </div>
          {camera ? (
            <span className="flex items-center gap-1.5 text-xs text-green-700"><CheckCircle className="h-4 w-4" /> On</span>
          ) : (
            <Button size="sm" variant="outline" onClick={turnOnCamera} disabled={busy !== null}>Turn on camera</Button>
          )}
        </div>

        <div className="flex items-start gap-3 px-4 py-3">
          <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Entire screen</p>
            {screen ? (
              <p className="mt-1 text-xs text-muted-foreground">Sharing your entire screen.</p>
            ) : (
              screenError && <p role="alert" className="mt-1 text-sm text-destructive">{screenError}</p>
            )}
          </div>
          {screen ? (
            <span className="flex items-center gap-1.5 text-xs text-green-700"><CheckCircle className="h-4 w-4" /> Sharing</span>
          ) : (
            <Button size="sm" variant="outline" onClick={shareScreen} disabled={busy !== null}>Share your entire screen</Button>
          )}
        </div>

        <div className="flex items-start gap-3 px-4 py-3">
          {secondScreen
            ? <MonitorX className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            : <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">One screen</p>
            {secondScreen && (
              <p role="alert" className="mt-1 text-sm text-destructive">
                A second screen is connected. Disconnect it, or set your displays to mirror, to continue.
              </p>
            )}
          </div>
          {!secondScreen && (
            <span className="flex items-center gap-1.5 text-xs text-green-700"><CheckCircle className="h-4 w-4" /> Only one</span>
          )}
        </div>

        <label className="flex cursor-pointer items-start gap-3 bg-muted/30 px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => onAcknowledge(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
          />
          <span>I understand, and I'll keep my camera on and my entire screen shared during the interview.</span>
        </label>
      </div>
    </section>
  );
}
