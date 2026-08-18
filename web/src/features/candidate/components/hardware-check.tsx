import { CheckCircle, Circle, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DEFAULT_THRESHOLDS, testInternetSpeed, type InternetSpeedResult } from "@/utils/internet-speed-test";
import {
  ProctoringState,
  checkCamera,
  getBrowserInfo,
  getCurrentTime,
  getOSInfo,
  type HardwareCheckingProgress,
} from "@/utils/hardware-utils";

interface HardwareCheckProps {
  onStart?: () => void;
}

function StateIcon({ state }: { state: ProctoringState }) {
  if (state === ProctoringState.LOADING) return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  if (state === ProctoringState.PASSED) return <CheckCircle className="size-4 text-success" />;
  if (state === ProctoringState.ERROR) return <XCircle className="size-4 text-destructive" />;
  return <Circle className="size-4 text-muted-foreground/40" />;
}

function stateLabel(state: ProctoringState) {
  if (state === ProctoringState.LOADING) return "Checking...";
  if (state === ProctoringState.PASSED) return "Passed";
  if (state === ProctoringState.ERROR) return "Failed";
  return "Waiting";
}

const REQUIRE_CAMERA = import.meta.env.VITE_REQUIRE_CAMERA === "true";

export function HardwareCheck({ onStart }: HardwareCheckProps) {
  const [progress, setProgress] = useState<HardwareCheckingProgress>({
    osAndBrowser: ProctoringState.WAITING,
    internet: ProctoringState.WAITING,
    camera: ProctoringState.WAITING,
    audio: ProctoringState.WAITING,
    microphone: ProctoringState.WAITING,
  });
  const [allPassed, setAllPassed] = useState(false);
  const [internetResult, setInternetResult] = useState<InternetSpeedResult | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const { osAndBrowser, internet, camera, audio, microphone } = progress;
    setAllPassed(
      osAndBrowser === ProctoringState.PASSED &&
        internet === ProctoringState.PASSED &&
        camera === ProctoringState.PASSED &&
        audio === ProctoringState.PASSED &&
        microphone === ProctoringState.PASSED
    );
  }, [progress]);

  useEffect(() => {
    if (videoRef.current && videoStream) videoRef.current.srcObject = videoStream;
  }, [videoStream]);

  useEffect(() => {
    return () => {
      videoStream?.getTracks().forEach((t) => t.stop());
    };
  }, [videoStream]);

  const checkAudioPlayback = async (): Promise<boolean> => {
    try {
      const AudioCtx = window.AudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") await ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
      return true;
    } catch {
      return false;
    }
  };

  const startAudioLevelMonitoring = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const update = () => {
        analyser.getByteFrequencyData(data);
        setAudioLevel(Math.round(data.reduce((a, b) => a + b, 0) / data.length));
        requestAnimationFrame(update);
      };
      update();
    } catch {
      /* silent */
    }
  };

  // Step 1: OS & browser
  useEffect(() => {
    setProgress((p) => ({ ...p, osAndBrowser: ProctoringState.LOADING }));
    setTimeout(() => {
      getBrowserInfo();
      getOSInfo();
      getCurrentTime();
      setProgress((p) => ({
        ...p,
        osAndBrowser: ProctoringState.PASSED,
        internet: ProctoringState.LOADING,
      }));
    }, 800);
  }, []);

  // Step 2: Internet
  useEffect(() => {
    if (progress.internet !== ProctoringState.LOADING) return;
    testInternetSpeed(DEFAULT_THRESHOLDS).then((result) => {
      setInternetResult(result);
      setProgress((p) => ({
        ...p,
        internet: result.passed ? ProctoringState.PASSED : ProctoringState.ERROR,
        ...(result.passed
          ? REQUIRE_CAMERA
            ? { camera: ProctoringState.LOADING }
            : { camera: ProctoringState.PASSED, microphone: ProctoringState.LOADING }
          : {}),
      }));
    });
  }, [progress.internet]);

  // Step 3: Camera + microphone (or microphone-only when camera disabled)
  useEffect(() => {
    const cameraLoading = progress.camera === ProctoringState.LOADING;
    const micLoading = !REQUIRE_CAMERA && progress.microphone === ProctoringState.LOADING;
    if (!cameraLoading && !micLoading) return;

    const getStream = REQUIRE_CAMERA
      ? checkCamera()
      : navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);

    getStream.then((stream) => {
      if (stream) {
        if (REQUIRE_CAMERA) setVideoStream(stream);
        startAudioLevelMonitoring(stream);
        setProgress((p) => ({
          ...p,
          ...(REQUIRE_CAMERA ? { camera: ProctoringState.PASSED } : {}),
          microphone: ProctoringState.PASSED,
          audio: ProctoringState.LOADING,
        }));
      } else {
        setProgress((p) => ({
          ...p,
          ...(REQUIRE_CAMERA ? { camera: ProctoringState.ERROR } : {}),
          microphone: ProctoringState.ERROR,
        }));
      }
    });
  }, [progress.camera, progress.microphone]);

  // Step 4: Audio output
  useEffect(() => {
    if (progress.audio !== ProctoringState.LOADING) return;
    checkAudioPlayback().then((ok) => {
      setProgress((p) => ({
        ...p,
        audio: ok ? ProctoringState.PASSED : ProctoringState.ERROR,
      }));
    });
  }, [progress.audio]);

  const retryAll = () => {
    videoStream?.getTracks().forEach((t) => t.stop());
    setVideoStream(null);
    setInternetResult(null);
    setProgress({
      osAndBrowser: ProctoringState.LOADING,
      internet: ProctoringState.WAITING,
      camera: ProctoringState.WAITING,
      audio: ProctoringState.WAITING,
      microphone: ProctoringState.WAITING,
    });
  };

  const thresholds = DEFAULT_THRESHOLDS;

  const rows: { key: keyof HardwareCheckingProgress; label: string }[] = [
    { key: "osAndBrowser", label: "OS & browser" },
    { key: "internet", label: "Internet" },
    ...(REQUIRE_CAMERA ? [{ key: "camera" as const, label: "Camera" }] : []),
    { key: "microphone", label: "Microphone" },
    { key: "audio", label: "Audio output" },
  ];

  const hasError = Object.values(progress).some((s) => s === ProctoringState.ERROR);

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* Camera preview */}
      {REQUIRE_CAMERA && (
        <div className="relative aspect-video bg-black">
          {videoStream ? (
            <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <svg className="size-10 opacity-30" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-xs">Camera not active</p>
            </div>
          )}
          {progress.camera === ProctoringState.PASSED && videoStream && (
            <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-xs text-background">
              <span className="size-1.5 animate-pulse rounded-full bg-background" />
              LIVE
            </span>
          )}
        </div>
      )}

      {/* Checklist */}
      <div className="divide-y">
        {rows.map(({ key, label }) => (
          <div key={key} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{label}</span>
              <div className="flex items-center gap-2">
                <StateIcon state={progress[key]} />
                <span
                  className={`w-16 text-right text-xs ${
                    progress[key] === ProctoringState.PASSED
                      ? "text-success"
                      : progress[key] === ProctoringState.ERROR
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {stateLabel(progress[key])}
                </span>
              </div>
            </div>

            {/* Internet speed details */}
            {key === "internet" && internetResult && (
              <div className="mt-2 flex gap-3 text-xs">
                <span className={internetResult.download >= thresholds.minDownloadMbps ? "text-success" : "text-destructive"}>
                  ↓ {internetResult.download} Mbps
                </span>
                <span className={internetResult.upload >= thresholds.minUploadMbps ? "text-success" : "text-destructive"}>
                  ↑ {internetResult.upload} Mbps
                </span>
                <span className={internetResult.ping <= thresholds.maxPingMs ? "text-success" : "text-destructive"}>
                  {internetResult.ping} ms
                </span>
              </div>
            )}

            {/* Mic level bar */}
            {key === "microphone" && progress.microphone === ProctoringState.PASSED && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-success transition-all duration-150"
                    style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs text-muted-foreground">{audioLevel}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-3">
        {hasError && (
          <Button variant="outline" size="sm" onClick={retryAll}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Retry
          </Button>
        )}
        <Button size="sm" className="ml-auto" disabled={!allPassed} onClick={onStart}>
          Start Interview
        </Button>
      </div>
    </div>
  );
}
