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
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/80">
        <Loader2 className="h-3 w-3 animate-spin text-sky-600" />
        Memeriksa...
      </span>
    );
  }
  if (state === ProctoringState.PASSED) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        Siap
      </span>
    );
  }
  if (state === ProctoringState.WARNING) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        <AlertTriangle className="h-3 w-3 text-amber-600" />
        Cukup
      </span>
    );
  }
  if (state === ProctoringState.ERROR) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
        <XCircle className="h-3 w-3 text-rose-600" />
        Gagal
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-normal px-2 py-0.5">
      <Circle className="h-2.5 w-2.5 text-slate-300" />
      Menunggu
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
  const [soundTested, setSoundTested] = useState(false);
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
      gain.gain.value = 0.001; // Silent tone
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
      return true;
    } catch (e) {
      return false;
    }
  };

  const playTestSound = async () => {
    try {
      setIsPlayingTestSound(true);
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") await ctx.resume();

      // Pleasant 2-tone chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.2); // A5

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc1.stop(ctx.currentTime + 0.2);
      osc2.start(ctx.currentTime + 0.2);
      osc2.stop(ctx.currentTime + 0.6);

      setTimeout(() => {
        setIsPlayingTestSound(false);
        setSoundTested(true);
      }, 700);
    } catch {
      setIsPlayingTestSound(false);
    }
  };

  const thresholds = DEFAULT_THRESHOLDS;

  const runAllChecks = async () => {
    // 1. OS & Browser Check
    setProgress((prev) => ({ ...prev, osAndBrowser: ProctoringState.LOADING }));
    const os = getOSInfo();
    const browser = getBrowserInfo();
    const osBrowserValid = os !== "Unknown" && browser.browser !== "Unknown";
    setProgress((prev) => ({
      ...prev,
      osAndBrowser: osBrowserValid ? ProctoringState.PASSED : ProctoringState.ERROR,
    }));

    // 2. Camera Check (if required)
    if (REQUIRE_CAMERA) {
      setProgress((prev) => ({ ...prev, camera: ProctoringState.LOADING }));
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setVideoStream(stream);
        setProgress((prev) => ({ ...prev, camera: ProctoringState.PASSED }));
      } catch {
        setProgress((prev) => ({ ...prev, camera: ProctoringState.ERROR }));
      }
    } else {
      setProgress((prev) => ({ ...prev, camera: ProctoringState.PASSED }));
    }

    // 3. Audio Output Check
    setProgress((prev) => ({ ...prev, audio: ProctoringState.LOADING }));
    const audioOk = await checkAudioPlayback();
    setProgress((prev) => ({
      ...prev,
      audio: audioOk ? ProctoringState.PASSED : ProctoringState.ERROR,
    }));

    // 4. Microphone Input Check
    setProgress((prev) => ({ ...prev, microphone: ProctoringState.LOADING }));
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      const analyser = audioContext.createAnalyser();
      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(analyser);
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;
        setAudioLevel(avg);
        requestAnimationFrame(updateLevel);
      };
      updateLevel();

      setProgress((prev) => ({ ...prev, microphone: ProctoringState.PASSED }));
    } catch {
      setProgress((prev) => ({ ...prev, microphone: ProctoringState.ERROR }));
    }

    // 5. Internet Connection Speed
    setProgress((prev) => ({ ...prev, internet: ProctoringState.LOADING }));
    const netRes = await testInternetSpeed(thresholds);
    setInternetResult(netRes);

    if (netRes.status === "passed") {
      setProgress((prev) => ({ ...prev, internet: ProctoringState.PASSED }));
    } else if (netRes.status === "inconclusive") {
      setProgress((prev) => ({ ...prev, internet: ProctoringState.WARNING }));
    } else {
      setProgress((prev) => ({ ...prev, internet: ProctoringState.ERROR }));
    }
  };

  useEffect(() => {
    runAllChecks();
  }, []);

  const retryAll = () => {
    runAllChecks();
  };

  const rows = [
    {
      key: "osAndBrowser" as const,
      label: "OS & Browser",
      description: `${getOSInfo()} • ${getBrowserInfo().browser}`,
      icon: <Laptop className="h-4 w-4 text-slate-600" />,
    },
    {
      key: "internet" as const,
      label: "Koneksi Internet",
      description: "Kecepatan dan stabilitas jaringan untuk wawancara suara real-time",
      icon: <Wifi className="h-4 w-4 text-slate-600" />,
    },
    ...(REQUIRE_CAMERA
      ? [
          {
            key: "camera" as const,
            label: "Kamera Video",
            description: "Pemeriksaan input kamera",
            icon: <Video className="h-4 w-4 text-slate-600" />,
          },
        ]
      : []),
    {
      key: "microphone" as const,
      label: "Input Mikrofon",
      description: "Perekaman audio suara kandidat",
      icon: <Mic className="h-4 w-4 text-slate-600" />,
    },
    {
      key: "audio" as const,
      label: "Speaker / Output Audio",
      description: "Memastikan Anda dapat mendengar pewawancara AI",
      icon: <Volume2 className="h-4 w-4 text-slate-600" />,
    },
  ];

  const hasError = Object.values(progress).some(
    (s) => s === ProctoringState.ERROR
  );

  const passedCount = Object.values(progress).filter(
    (s) => s === ProctoringState.PASSED || s === ProctoringState.WARNING
  ).length;
  const totalChecks = rows.length;

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white overflow-hidden shadow-xs">
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

      {/* ── Header bar of system check (Compact 1-row layout) ── */}
      <div className="px-4 sm:px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-bold text-slate-900 truncate">
            Kesiapan Sistem &amp; Perangkat
          </span>
        </div>
        <div className="shrink-0">
          {allPassed ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              {passedCount}/{totalChecks} Siap
            </span>
          ) : (
            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {passedCount}/{totalChecks} Memeriksa...
            </span>
          )}
        </div>
      </div>

      {/* ── Checklist items (Sleek List Design) ── */}
      <div className="divide-y divide-slate-100">
        {rows.map(({ key, label, description, icon }) => (
          <div key={key} className="px-4 sm:px-5 py-3.5 hover:bg-slate-50/40 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200/60">
                  {icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {description}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <StateBadge state={progress[key]} />
              </div>
            </div>

            {/* Internet details: Minimalist single strip */}
            {key === "internet" && internetResult && (
              <div className="mt-2 pl-11">
                {internetResult.status === "inconclusive" ? (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200 leading-relaxed">
                    Kecepatan internet tidak dapat diukur akurat, namun Anda tetap dapat melanjutkan wawancara.
                  </p>
                ) : (
                  <div className="inline-flex items-center gap-2.5 px-3 py-1 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 flex-wrap">
                    <span className="font-semibold text-slate-800">↓ {internetResult.download ?? "—"} Mbps</span>
                    <span className="text-slate-300">•</span>
                    <span className="font-semibold text-slate-800">↑ {internetResult.upload ?? "—"} Mbps</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500">Ping: {internetResult.ping ?? "—"} ms</span>
                  </div>
                )}
              </div>
            )}

            {/* Microphone test visualizer */}
            {key === "microphone" && progress.microphone === ProctoringState.PASSED && (
              <div className="mt-2 pl-11 flex items-center gap-3">
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60 max-w-xs">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-75 rounded-full"
                    style={{ width: `${Math.min(audioLevel * 3, 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-medium text-slate-600 shrink-0">
                  {audioLevel > 5 ? "🎙️ Suara terdeteksi" : "Hening / Siap"}
                </span>
              </div>
            )}

            {/* Audio speaker test sound button */}
            {key === "audio" && progress.audio === ProctoringState.PASSED && (
              <div className="mt-2 pl-11 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={playTestSound}
                  disabled={isPlayingTestSound}
                  className="h-8 px-3 text-xs text-slate-700 bg-white hover:bg-slate-50 border-slate-200 cursor-pointer shadow-2xs rounded-xl"
                >
                  <Volume2 className={cn("h-3.5 w-3.5 mr-1.5 text-primary", isPlayingTestSound && "animate-bounce")} />
                  {isPlayingTestSound ? "Memutar Suara..." : soundTested ? "✓ Suara Terdengar (Uji Lagi)" : "Uji Coba Suara (Speaker)"}
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  (Klik untuk memastikan speaker terdengar)
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Footer CTA & Actions ── */}
      <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/60 flex flex-col gap-3">
        <p className="text-[11px] sm:text-xs text-muted-foreground text-center sm:text-left">
          Mikrofon akan aktif otomatis saat Anda menekan tombol di bawah.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {hasError ? (
            <Button
              variant="outline"
              size="sm"
              onClick={retryAll}
              className="w-full sm:w-auto h-10 px-4 text-xs font-semibold cursor-pointer rounded-xl"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Ulangi Pemeriksaan
            </Button>
          ) : (
            <div className="hidden sm:block text-xs text-emerald-700 font-medium">
              ✓ Semua sistem siap
            </div>
          )}

          <Button
            size="lg"
            disabled={!allPassed}
            onClick={onStart}
            className={cn(
              "w-full sm:w-auto h-11 px-6 rounded-2xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 text-white",
              allPassed
                ? "bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 shadow-teal-500/20 active:scale-98"
                : "bg-slate-300 text-slate-500 cursor-not-allowed opacity-60 shadow-none"
            )}
          >
            <Mic className="h-4 w-4" />
            <span>Mulai Sesi Wawancara →</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HardwareCheck;
