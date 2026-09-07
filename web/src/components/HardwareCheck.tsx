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
} from "@/utils/hardwareUtils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, CheckCircle, XCircle, Loader2, Circle, Mic } from "lucide-react";

interface HardwareCheckProps {
  onStart?: (selectedMicId?: string) => void;
}

function StateIcon({ state }: { state: ProctoringState }) {
  if (state === ProctoringState.LOADING)
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (state === ProctoringState.PASSED)
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (state === ProctoringState.ERROR)
    return <XCircle className="h-4 w-4 text-destructive" />;
  return <Circle className="h-4 w-4 text-muted-foreground/40" />;
}

function stateLabel(state: ProctoringState) {
  if (state === ProctoringState.LOADING) return "Checking...";
  if (state === ProctoringState.PASSED) return "Passed";
  if (state === ProctoringState.ERROR) return "Failed";
  return "Waiting";
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
  const [internetResult, setInternetResult] =
    useState<InternetSpeedResult | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

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
    if (videoRef.current && videoStream)
      videoRef.current.srcObject = videoStream;
  }, [videoStream]);

  // Clean up media streams and audio context on unmount
  useEffect(() => {
    return () => {
      videoStream?.getTracks().forEach((t) => t.stop());
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      sourceNodeRef.current?.disconnect();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [videoStream]);

  // Resume suspended AudioContext on user interaction
  useEffect(() => {
    const unlockAudio = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
    };
    window.addEventListener("click", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  // Listen for device changes (e.g. Bluetooth headset connected/disconnected)
  useEffect(() => {
    const handleDeviceChange = async () => {
      const inputs = await loadAudioDevices();
      if (inputs.length > 0 && selectedMicId) {
        const stillExists = inputs.some((d) => d.deviceId === selectedMicId);
        if (!stillExists) {
          handleMicChange(inputs[0].deviceId);
        }
      }
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [selectedMicId]);

  const checkAudioPlayback = async (): Promise<boolean> => {
    try {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
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

  const startAudioLevelMonitoring = async (stream: MediaStream) => {
    try {
      audioStreamRef.current = stream;
      const tracks = stream.getAudioTracks();
      if (tracks.length === 0) {
        console.warn("[HardwareCheck] No audio tracks found in stream");
        return;
      }

      // Clean up previous context if any
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      sourceNodeRef.current?.disconnect();
      audioCtxRef.current?.close().catch(() => {});

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }

      const source = ctx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      analyserRef.current = analyser;
      source.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);
      const update = () => {
        if (!analyserRef.current) return;
        analyser.getByteTimeDomainData(data);

        // Compute RMS volume
        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) {
          const norm = (data[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / data.length);
        // Normal speech rms is ~0.05-0.2, amplify to 0-100%
        const volume = Math.min(100, Math.round(rms * 400));

        setAudioLevel(volume);
        animFrameRef.current = requestAnimationFrame(update);
      };
      update();
    } catch (e) {
      console.error("[HardwareCheck] Audio level monitoring error:", e);
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
        internet: result.passed
          ? ProctoringState.PASSED
          : ProctoringState.ERROR,
        ...(result.passed
          ? REQUIRE_CAMERA
            ? { camera: ProctoringState.LOADING }
            : {
                camera: ProctoringState.PASSED,
                microphone: ProctoringState.LOADING,
              }
          : {}),
      }));
    });
  }, [progress.internet]);

  const loadAudioDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      setAudioDevices(audioInputs);
      return audioInputs;
    } catch {
      return [];
    }
  };

  const handleMicChange = async (newDeviceId: string) => {
    setSelectedMicId(newDeviceId);
    try {
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: newDeviceId } },
      });
      startAudioLevelMonitoring(newStream);
    } catch (err) {
      console.error("[HardwareCheck] Failed to switch microphone:", err);
    }
  };

  // Step 3: Camera + microphone (or microphone-only when camera disabled)
  useEffect(() => {
    const cameraLoading = progress.camera === ProctoringState.LOADING;
    const micLoading =
      !REQUIRE_CAMERA && progress.microphone === ProctoringState.LOADING;
    if (!cameraLoading && !micLoading) return;

    const getStream = REQUIRE_CAMERA
      ? checkCamera()
      : navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);

    getStream.then((stream) => {
      if (stream) {
        if (REQUIRE_CAMERA) setVideoStream(stream);
        startAudioLevelMonitoring(stream);

        const currentTrack = stream.getAudioTracks()[0];
        const trackDeviceId = currentTrack?.getSettings().deviceId;

        loadAudioDevices().then((devices) => {
          if (trackDeviceId) {
            setSelectedMicId(trackDeviceId);
          } else if (devices.length > 0) {
            setSelectedMicId(devices[0].deviceId);
          }
        });

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
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    sourceNodeRef.current?.disconnect();
    audioCtxRef.current?.close().catch(() => {});
    setVideoStream(null);
    setAudioLevel(0);
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

  const hasError = Object.values(progress).some(
    (s) => s === ProctoringState.ERROR,
  );

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
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
              <svg
                className="w-10 h-10 opacity-30"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
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
          <div key={key} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{label}</span>
              <div className="flex items-center gap-2">
                <StateIcon state={progress[key]} />
                <span
                  className={`text-xs w-16 text-right ${
                    progress[key] === ProctoringState.PASSED
                      ? "text-green-600"
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
                <span
                  className={
                    internetResult.download >= thresholds.minDownloadMbps
                      ? "text-green-600"
                      : "text-destructive"
                  }
                >
                  ↓ {internetResult.download} Mbps
                </span>
                <span
                  className={
                    internetResult.upload >= thresholds.minUploadMbps
                      ? "text-green-600"
                      : "text-destructive"
                  }
                >
                  ↑ {internetResult.upload} Mbps
                </span>
                <span
                  className={
                    internetResult.ping <= thresholds.maxPingMs
                      ? "text-green-600"
                      : "text-destructive"
                  }
                >
                  {internetResult.ping} ms
                </span>
              </div>
            )}

            {/* Mic selector & level bar */}
            {key === "microphone" &&
              progress.microphone === ProctoringState.PASSED && (
                <div className="mt-2.5 space-y-2">
                  {audioDevices.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Mic className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Select
                        value={selectedMicId}
                        onValueChange={handleMicChange}
                      >
                        <SelectTrigger className="h-7 text-xs flex-1 bg-background/50">
                          <SelectValue placeholder="Choose microphone" />
                        </SelectTrigger>
                        <SelectContent>
                          {audioDevices.map((device, idx) => (
                            <SelectItem
                              key={device.deviceId || `mic-${idx}`}
                              value={device.deviceId}
                              className="text-xs"
                            >
                              {device.label || `Microphone ${idx + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all duration-150"
                        style={{ width: `${Math.min(audioLevel, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right font-mono">
                      {audioLevel}%
                    </span>
                  </div>
                </div>
              )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t flex items-center justify-between gap-3 bg-muted/30">
        {hasError && (
          <Button variant="outline" size="sm" onClick={retryAll}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        )}
        <Button
          size="sm"
          className="ml-auto"
          disabled={!allPassed}
          onClick={() => onStart?.(selectedMicId)}
        >
          Start Interview
        </Button>
      </div>
    </div>
  );
};

export default HardwareCheck;
