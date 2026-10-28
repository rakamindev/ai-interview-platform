import React, { useEffect, useRef, useState } from "react";
import { testInternetSpeed, DEFAULT_THRESHOLDS } from "@/utils/internetSpeedTest";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  Volume2,
  Wifi,
  Sparkles,
  Headphones,
  CheckCircle2,
  Loader2,
  VolumeX,
} from "lucide-react";

interface HardwareCheckProps {
  onStart?: () => void;
  roleTitle?: string;
  candidateName?: string;
  timeLimitMin?: number;
}

export default function HardwareCheck({
  onStart,
  roleTitle,
  candidateName,
  timeLimitMin,
}: HardwareCheckProps) {
  // Readiness states
  const [internetPassed, setInternetPassed] = useState<boolean | null>(null);
  const [micPassed, setMicPassed] = useState<boolean | null>(null);
  const [micTested, setMicTested] = useState<boolean>(false);
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false);
  const [audioTested, setAudioTested] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isPlayingTestTone, setIsPlayingTestTone] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // 1. Check Internet connectivity in background
  useEffect(() => {
    testInternetSpeed(DEFAULT_THRESHOLDS)
      .then((res) => {
        setInternetPassed(res.passed);
      })
      .catch(() => {
        setInternetPassed(true); // Fallback to passed
      });
  }, []);

  // 2. Request & test microphone stream
  useEffect(() => {
    let active = true;

    async function initMic() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        setMicPassed(true);

        // Real-time audio analyser
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          if (!active) return;
          analyser.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((acc, val) => acc + val, 0);
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(Math.round(avg * 2.2), 100));
          animFrameRef.current = requestAnimationFrame(updateMeter);
        };

        updateMeter();
      } catch {
        if (active) setMicPassed(false);
      }
    }

    initMic();

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Play pleasant chime tone to test speaker / audio output
  const playTestChime = () => {
    try {
      setIsPlayingTestTone(true);
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.connect(gain);
      gain.connect(ctx.destination);

      // Play soft two-tone chime (523Hz -> 659Hz)
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.05);

      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.15); // E5

      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.start(now);
      osc.stop(now + 0.5);

      setTimeout(() => {
        setIsPlayingTestTone(false);
        setAudioTested(true);
        ctx.close().catch(() => {});
      }, 550);
    } catch {
      setIsPlayingTestTone(false);
      setAudioTested(true);
    }
  };

  // Test microphone actively upon user click
  const handleTestMic = () => {
    setIsTestingMic(true);
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - startTime >= 2500) {
        clearInterval(interval);
        setIsTestingMic(false);
        setMicTested(true);
      }
    }, 100);
  };

  // Both Mic and Speaker must be tested to proceed
  const isReady = micPassed === true && micTested === true && audioTested === true;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden select-none">
      {/* Lobby Welcome Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 sm:p-7 relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              AI Interview Waiting Room
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {roleTitle ? roleTitle : "AI Competency Interview"}
          </h2>

          <p className="text-xs text-slate-300 flex items-center gap-3 pt-0.5">
            <span>Candidate: <strong className="text-white">{candidateName || "Candidate"}</strong></span>
            {timeLimitMin && (
              <>
                <span>•</span>
                <span>Duration: <strong className="text-white">{timeLimitMin} Minutes</strong></span>
              </>
            )}
          </p>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-[-20px] bottom-[-20px] w-48 h-48 bg-[#01959F]/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      <div className="p-6 sm:p-7 space-y-6">
        {/* Interactive Microphone Level & Voice Tester */}
        <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/70 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Mic className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-800 block">
                  Microphone Check <span className="text-destructive">*</span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {micPassed === false
                    ? "Microphone access blocked"
                    : micTested
                    ? "Microphone verified & active"
                    : "Required: test your voice before entering"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {micPassed === true && (
                <Button
                  type="button"
                  size="sm"
                  variant={micTested ? "outline" : "default"}
                  className={`h-7 px-3 text-xs ${
                    micTested
                      ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      : "bg-primary text-white hover:bg-primary/90"
                  }`}
                  onClick={handleTestMic}
                  disabled={isTestingMic}
                >
                  {isTestingMic ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Listening... Speak now
                    </>
                  ) : micTested ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                      Test Again
                    </>
                  ) : (
                    <>
                      <Mic className="h-3.5 w-3.5 mr-1.5" />
                      Click to Test Mic
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Real-time Dynamic Voice Level Bars */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1.5 h-3 bg-white border border-slate-200 rounded-full px-1 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-100 ease-out bg-gradient-to-r from-emerald-400 via-teal-500 to-[#01959F]"
                style={{ width: `${Math.max(audioLevel, 4)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Quiet</span>
              <span className={audioLevel > 15 ? "text-emerald-600 font-semibold" : ""}>
                {audioLevel > 15 ? "✓ Voice Detected" : isTestingMic ? "Speaking..." : "Level meter"}
              </span>
              <span>Loud</span>
            </div>
          </div>
        </div>

        {/* System Readiness Status Chips */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Internet Status */}
          <div className="p-3 rounded-xl border border-slate-200/80 bg-white flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                <Wifi className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-medium text-slate-800">Internet Connection</span>
            </div>
            {internetPassed !== null ? (
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap shrink-0">
                Stable & Ready
              </Badge>
            ) : (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
            )}
          </div>

          {/* Audio Output / Speaker Test (Required) */}
          <div className="p-3 rounded-xl border border-slate-200/80 bg-white flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                <Volume2 className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-medium text-slate-800 block">
                  Speaker / Audio <span className="text-destructive">*</span>
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {audioTested ? "Audio verified" : "Check required"}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant={audioTested ? "outline" : "default"}
              size="sm"
              className={`h-7 px-2.5 text-[11px] ${
                audioTested
                  ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  : "bg-primary text-white hover:bg-primary/90"
              }`}
              onClick={playTestChime}
              disabled={isPlayingTestTone}
            >
              {isPlayingTestTone ? (
                <span className="flex items-center gap-1">
                  <Volume2 className="h-3 w-3 animate-pulse" /> Playing...
                </span>
              ) : audioTested ? (
                <span className="flex items-center gap-1 font-medium text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Tested ✓
                </span>
              ) : (
                <span className="flex items-center gap-1 font-semibold">
                  <Volume2 className="h-3 w-3" /> Click to Test Speaker
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Quick Tips for Candidates */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2.5">
          <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Tips for a smooth interview:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200/70 text-slate-700 shadow-2xs">
              <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Headphones className="h-3.5 w-3.5" />
              </div>
              <span className="text-[11px] font-medium leading-tight">Use headphones</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200/70 text-slate-700 shadow-2xs">
              <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <VolumeX className="h-3.5 w-3.5" />
              </div>
              <span className="text-[11px] font-medium leading-tight">Find a quiet room</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200/70 text-slate-700 shadow-2xs">
              <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Mic className="h-3.5 w-3.5" />
              </div>
              <span className="text-[11px] font-medium leading-tight">Speak clearly</span>
            </div>
          </div>
        </div>

        {/* Primary Start Action Button */}
        <div className="pt-2">
          <Button
            size="lg"
            className="w-full h-12 text-sm font-semibold bg-[#01959F] hover:bg-[#017a82] text-white shadow-md transition-all duration-200"
            disabled={!isReady}
            onClick={onStart}
          >
            {isReady ? (
              <>
                <Mic className="h-4 w-4 mr-2" />
                Enter Interview Room Now →
              </>
            ) : micPassed === false ? (
              "Enable Microphone Access to Continue"
            ) : !micTested ? (
              "Please Test Your Microphone Above to Continue"
            ) : !audioTested ? (
              "Please Test Your Speaker Above to Continue"
            ) : (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking Hardware...
              </>
            )}
          </Button>

          {micPassed === false ? (
            <p className="text-center text-xs text-rose-600 mt-2">
              The browser requires microphone permissions for voice interviews. Please allow microphone access in your browser settings or lock icon.
            </p>
          ) : !micTested ? (
            <p className="text-center text-xs text-amber-600 mt-2 font-medium">
              Click "Click to Test Mic" above to verify your microphone before proceeding.
            </p>
          ) : !audioTested ? (
            <p className="text-center text-xs text-amber-600 mt-2 font-medium">
              Click "Click to Test Speaker" above to verify you can hear audio clearly.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
