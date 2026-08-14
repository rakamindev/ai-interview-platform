import React, { useEffect, useRef, useState } from "react";
import { testInternetSpeed, DEFAULT_THRESHOLDS, type InternetSpeedResult } from "@/utils/internetSpeedTest";
import {
  ProctoringState,
  type HardwareCheckingProgress,
  getBrowserInfo,
  getOSInfo,
  checkCamera,
  getCurrentTime,
} from "@/utils/hardwareUtils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  AlertTriangle,
  Laptop,
  Wifi,
  Video,
  Mic,
  Volume2,
  Sparkles,
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HardwareCheckProps {
  onStart?: () => void;
}

function StateBadge({ state }: { state: ProctoringState }) {
  if (state === ProctoringState.LOADING) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200/80">
        <Loader2 className="h-3 w-3 animate-spin text-sky-600" />
        Checking...
      </span>
    );
  }
  if (state === ProctoringState.PASSED) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        Passed
      </span>
    );
  }
  if (state === ProctoringState.WARNING) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        <AlertTriangle className="h-3 w-3 text-amber-600" />
        Unverified
      </span>
    );
  }
  if (state === ProctoringState.ERROR) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
        <XCircle className="h-3.5 w-3.5 text-rose-600" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-normal px-2.5 py-1">
      <Circle className="h-3 w-3 text-slate-300" />
      Waiting
    </span>
  );
}

const REQUIRE_CAMERA = import.meta.env.VITE_REQUIRE_CAMERA === "true";

const HardwareCheck: React.FC<HardwareCheckProps> = ({ onStart }) => {
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
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const { osAndBrowser, internet, camera, audio, microphone } = progress;
    const internetOk = internet === ProctoringState.PASSED || internet === ProctoringState.WARNING;
    setAllPassed(
      osAndBrowser === ProctoringState.PASSED &&
      internetOk &&
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
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
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

  const playTestSound = async () => {
    try {
      setIsPlayingTestSound(true);
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") await ctx.resume();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3); // G5
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
      setTimeout(() => setIsPlayingTestSound(false), 700);
    } catch {
      setIsPlayingTestSound(false);
    }
  };

  const startAudioLevelMonitoring = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
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
      const internetState =
        result.status === "passed"
          ? ProctoringState.PASSED
          : result.status === "inconclusive"
          ? ProctoringState.WARNING
          : ProctoringState.ERROR;
      const canProceed = internetState !== ProctoringState.ERROR;
      setProgress((p) => ({
        ...p,
        internet: internetState,
        ...(canProceed
          ? REQUIRE_CAMERA
            ? { camera: ProctoringState.LOADING }
            : { camera: ProctoringState.PASSED, microphone: ProctoringState.LOADING }
          : {}),
      }));
    });
  }, [progress.internet]);

  // Step 3: Camera + microphone
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

  const rows: {
    key: keyof HardwareCheckingProgress;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: "osAndBrowser",
      label: "OS & Browser",
      description: "Compatible browser environment detected",
      icon: <Laptop className="h-4 w-4 text-slate-600" />,
    },
    {
      key: "internet",
      label: "Internet Connection",
      description: "Low-latency network for live voice streaming",
      icon: <Wifi className="h-4 w-4 text-slate-600" />,
    },
    ...(REQUIRE_CAMERA
      ? [
          {
            key: "camera" as const,
            label: "Camera",
            description: "Video stream verification",
            icon: <Video className="h-4 w-4 text-slate-600" />,
          },
        ]
      : []),
    {
      key: "microphone",
      label: "Microphone Input",
      description: "Voice capture and ambient noise level",
      icon: <Mic className="h-4 w-4 text-slate-600" />,
    },
    {
      key: "audio",
      label: "Speaker / Audio Output",
      description: "Ensures you can hear the AI interviewer",
      icon: <Volume2 className="h-4 w-4 text-slate-600" />,
    },
  ];

  const hasError = Object.values(progress).some(
    (s) => s === ProctoringState.ERROR || s === ProctoringState.WARNING
  );

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-xs">
      {/* Camera preview if required */}
      {REQUIRE_CAMERA && (
        <div className="relative bg-slate-900 aspect-video">
          {videoStream ? (
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Video className="w-8 h-8 opacity-40" />
              <p className="text-xs">Camera preview standby...</p>
            </div>
          )}
          {progress.camera === ProctoringState.PASSED && videoStream && (
            <span className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[11px] font-semibold bg-rose-600/90 text-white px-2.5 py-0.5 rounded-full backdrop-blur-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              LIVE CAMERA
            </span>
          )}
        </div>
      )}

      {/* Header bar of system check */}
      <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            System &amp; Hardware Readiness
          </span>
        </div>
        {allPassed ? (
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
            All Systems Ready
          </span>
        ) : (
          <span className="text-[11px] font-medium text-slate-500">
            Running automatic checks...
          </span>
        )}
      </div>

      {/* Checklist items */}
      <div className="divide-y divide-slate-100">
        {rows.map(({ key, label, description, icon }) => (
          <div key={key} className="px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  {icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{label}</p>
                  <p className="text-xs text-muted-foreground truncate hidden sm:block">
                    {description}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <StateBadge state={progress[key]} />
              </div>
            </div>

            {/* Internet details */}
            {key === "internet" && internetResult && (
              <div className="mt-2.5 pl-11">
                {internetResult.status === "inconclusive" ? (
                  <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    Couldn't accurately measure connection speed — you may proceed, but a stable connection is recommended.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={cn(
                      "px-2 py-0.5 rounded-md font-medium border",
                      (internetResult.download ?? 0) >= thresholds.minDownloadMbps
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    )}>
                      ↓ {internetResult.download ?? "—"} Mbps
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-md font-medium border",
                      (internetResult.upload ?? 0) >= thresholds.minUploadMbps
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    )}>
                      ↑ {internetResult.upload ?? "—"} Mbps
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-md font-medium border",
                      (internetResult.ping ?? Infinity) <= thresholds.maxPingMs
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    )}>
                      Ping: {internetResult.ping ?? "—"} ms
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Microphone test visualizer */}
            {key === "microphone" && progress.microphone === ProctoringState.PASSED && (
              <div className="mt-2.5 pl-11 flex items-center gap-3">
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-75 rounded-full"
                    style={{ width: `${Math.min(audioLevel * 2.5, 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-slate-500 w-12 text-right">
                  {audioLevel > 5 ? "Speaking" : "Quiet"}
                </span>
              </div>
            )}

            {/* Audio speaker test sound button */}
            {key === "audio" && progress.audio === ProctoringState.PASSED && (
              <div className="mt-2 pl-11 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={playTestSound}
                  disabled={isPlayingTestSound}
                  className="h-7 px-2.5 text-xs text-slate-600 bg-white hover:bg-slate-50 border-slate-200 cursor-pointer shadow-2xs"
                >
                  <Volume2 className={cn("h-3.5 w-3.5 mr-1 text-primary", isPlayingTestSound && "animate-bounce")} />
                  {isPlayingTestSound ? "Playing Chime..." : "Test Sound Output"}
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  (Click to verify you can hear audio)
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer CTA & Actions */}
      <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
        {hasError ? (
          <Button
            variant="outline"
            size="sm"
            onClick={retryAll}
            className="w-full sm:w-auto h-10 px-4 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry Checks
          </Button>
        ) : (
          <div className="text-xs text-muted-foreground text-center sm:text-left">
            <span>Ready when you are. Mic activates automatically.</span>
          </div>
        )}

        <Button
          size="lg"
          disabled={!allPassed}
          onClick={onStart}
          className={cn(
            "w-full sm:w-auto h-11 px-6 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 text-white",
            allPassed
              ? "bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 shadow-teal-500/20 active:scale-98"
              : "bg-slate-300 text-slate-500 cursor-not-allowed opacity-60 shadow-none"
          )}
        >
          <span>Begin AI Interview</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default HardwareCheck;
