import React, { useEffect, useRef, useState } from "react";
import {
  testInternetSpeed,
  DEFAULT_THRESHOLDS,
  type InternetSpeedResult,
} from "@/utils/internetSpeedTest";
import {
  ProctoringState,
  type HardwareCheckingProgress,
  getBrowserInfo,
  getOSInfo,
  checkCamera,
  getCurrentTime,
  isBrowserSupported,
} from "@/utils/hardwareUtils";
import { Button } from "@/components/ui/button";
import Notice from "@/components/Notice";
import { RefreshCw, CheckCircle, XCircle, Loader2, Circle } from "lucide-react";

interface HardwareCheckProps {
  onStart?: () => void;
}

function StateIcon({ state }: { state: ProctoringState }) {
  if (state === ProctoringState.LOADING)
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (state === ProctoringState.PASSED) return <CheckCircle className="h-4 w-4 text-green-700" />;
  if (state === ProctoringState.ERROR) return <XCircle className="h-4 w-4 text-destructive" />;
  return <Circle className="h-4 w-4 text-muted-foreground/40" />;
}

function stateLabel(state: ProctoringState) {
  if (state === ProctoringState.LOADING) return "Checking...";
  if (state === ProctoringState.PASSED) return "Passed";
  if (state === ProctoringState.ERROR) return "Failed";
  return "Waiting";
}

const REQUIRE_CAMERA = import.meta.env.VITE_REQUIRE_CAMERA === "true";

// What the candidate can do about each failed check.
const FAILURE_HINTS: Record<keyof HardwareCheckingProgress, string> = {
  osAndBrowser:
    "This browser is missing features the interview needs. Use a recent version of Chrome, Edge, Firefox, or Safari, and open the link over https.",
  internet: `Your connection is below the minimum (↓ ${DEFAULT_THRESHOLDS.minDownloadMbps} Mbps, ↑ ${DEFAULT_THRESHOLDS.minUploadMbps} Mbps, ping under ${DEFAULT_THRESHOLDS.maxPingMs} ms). Move closer to your router or switch networks, then retry.`,
  camera:
    "Allow camera access for this site in your browser settings and make sure a camera is connected, then retry.",
  microphone:
    "Allow microphone access for this site in your browser settings and make sure a microphone is connected, then retry.",
  audio: "We couldn't play sound. Check your speakers or headphones, then retry.",
};

const HardwareCheck: React.FC<HardwareCheckProps> = ({ onStart }) => {
  const [progress, setProgress] = useState<HardwareCheckingProgress>({
    osAndBrowser: ProctoringState.LOADING,
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
  const stopMicMonitoringRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const { osAndBrowser, internet, camera, audio, microphone } = progress;
    setAllPassed(
      osAndBrowser === ProctoringState.PASSED &&
        internet === ProctoringState.PASSED &&
        camera === ProctoringState.PASSED &&
        audio === ProctoringState.PASSED &&
        microphone === ProctoringState.PASSED,
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
      const AudioCtx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;
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

  // The interview opens its own stream, so this one must not keep the microphone on after the check.
  const stopMicMonitoring = () => {
    stopMicMonitoringRef.current?.();
    stopMicMonitoringRef.current = null;
  };

  useEffect(() => stopMicMonitoring, []);

  const startAudioLevelMonitoring = (stream: MediaStream) => {
    let frame = 0;
    let audioContext: AudioContext | null = null;
    stopMicMonitoringRef.current = () => {
      cancelAnimationFrame(frame);
      void audioContext?.close();
      stream.getTracks().forEach((t) => t.stop());
    };
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContext = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const update = () => {
        analyser.getByteFrequencyData(data);
        setAudioLevel(Math.round(data.reduce((a, b) => a + b, 0) / data.length));
        frame = requestAnimationFrame(update);
      };
      update();
    } catch {
      /* silent */
    }
  };

  // Step 1: OS & browser (re-runs whenever Retry resets it to LOADING)
  useEffect(() => {
    if (progress.osAndBrowser !== ProctoringState.LOADING) return;
    const timer = setTimeout(() => {
      getBrowserInfo();
      getOSInfo();
      getCurrentTime();
      const supported = isBrowserSupported();
      setProgress((p) => ({
        ...p,
        osAndBrowser: supported ? ProctoringState.PASSED : ProctoringState.ERROR,
        ...(supported ? { internet: ProctoringState.LOADING } : {}),
      }));
    }, 800);
    return () => clearTimeout(timer);
  }, [progress.osAndBrowser]);

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

    let abandoned = false;
    getStream.then((stream) => {
      if (abandoned) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
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
    return () => {
      abandoned = true;
    };
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
    stopMicMonitoring();
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
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      {/* Camera preview */}
      {REQUIRE_CAMERA && (
        <div className="relative bg-black aspect-video">
          {videoStream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <svg className="w-10 h-10 opacity-30" fill="currentColor" viewBox="0 0 20 20">
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
            <span className="absolute bottom-2 left-2 flex items-center gap-1 text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      )}

      {/* Checklist */}
      <div className="divide-y">
        {rows.map(({ key, label }) => (
          <div key={key} className="px-5 py-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{label}</span>
              <div className="flex items-center gap-2">
                <StateIcon state={progress[key]} />
                <span
                  className={`text-xs w-16 text-right ${
                    progress[key] === ProctoringState.PASSED
                      ? "text-green-700"
                      : progress[key] === ProctoringState.ERROR
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {stateLabel(progress[key])}
                </span>
              </div>
            </div>

            {progress[key] === ProctoringState.ERROR && (
              <Notice variant="error" className="mt-2 text-xs">
                {FAILURE_HINTS[key]}
              </Notice>
            )}

            {/* Internet speed details */}
            {key === "internet" && internetResult && (
              <div className="mt-2 flex gap-3 text-xs">
                <span
                  className={
                    internetResult.download >= thresholds.minDownloadMbps
                      ? "text-green-700"
                      : "text-destructive"
                  }
                >
                  ↓ {internetResult.download} Mbps
                </span>
                <span
                  className={
                    internetResult.upload >= thresholds.minUploadMbps
                      ? "text-green-700"
                      : "text-destructive"
                  }
                >
                  ↑ {internetResult.upload} Mbps
                </span>
                <span
                  className={
                    internetResult.ping <= thresholds.maxPingMs
                      ? "text-green-700"
                      : "text-destructive"
                  }
                >
                  {internetResult.ping} ms
                </span>
              </div>
            )}

            {/* Mic level bar */}
            {key === "microphone" && progress.microphone === ProctoringState.PASSED && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-rakamin-teal transition-all duration-150"
                    style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8 text-right">{audioLevel}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t bg-rakamin-light-cyan/40 px-5 py-4">
        {hasError && (
          <Button variant="outline" size="sm" onClick={retryAll}>
            <RefreshCw />
            Retry
          </Button>
        )}
        <Button size="sm" className="ml-auto" disabled={!allPassed} onClick={onStart}>
          Start Interview
        </Button>
      </div>
    </div>
  );
};

export default HardwareCheck;
