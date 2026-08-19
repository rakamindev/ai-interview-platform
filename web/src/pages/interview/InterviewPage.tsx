import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { CandidateStepper, type StepKey } from "@/components/interview/CandidateStepper";
import { WelcomeStep } from "@/components/interview/WelcomeStep";
import { DeviceCheckStep } from "@/components/interview/DeviceCheckStep";
import { CompleteStep } from "@/components/interview/CompleteStep";
import VoiceOrb, { type OrbSpeaker } from "@/components/interview/VoiceOrb";
import { CandidateStatusHeader } from "@/components/interview/CandidateStatusHeader";
import { CollapsibleTranscript } from "@/components/interview/CollapsibleTranscript";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { sessionsApi } from "@/services/sessions";
import { useToast } from "@/hooks/useToast";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CandidateInfo, InterviewSpeaker, TranscriptTurn, InterviewState } from "@/types";
import type { Lang } from "@/utils/candidateI18n";
import { candidateTranslations } from "@/utils/candidateI18n";
import { cn } from "@/lib/utils";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Stepper Stage
  const [stage, setStage] = useState<StepKey>("welcome");
  const [lang, setLang] = useState<Lang>("en");

  // Interview Live State
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  // 1. Fetch Candidate Info on mount
  const fetchInfo = useCallback(async () => {
    if (!token) {
      setLoadError("Invite token is missing from URL.");
      setLoadingInfo(false);
      return;
    }

    setLoadingInfo(true);
    setLoadError(null);
    try {
      const res = await sessionsApi.getCandidateInfo(token);
      const data = res.data;
      setCandidateInfo(data);

      if (data.language === "id" || data.language === "en") {
        setLang(data.language);
      }

      // Check if session has ended or is currently live
      if (data.session_status === "ended") {
        setStage("complete");
        setInterviewState("complete");
      } else if (data.session_status === "active") {
        // Active session -> can resume to live stage directly
        setStage("live");
      } else if (data.candidate_stage === "device_check") {
        setStage("device_check");
      } else {
        setStage("welcome");
      }
    } catch (err: any) {
      setLoadError(err?.response?.data?.error || "Invalid or expired interview invite token.");
    } finally {
      setLoadingInfo(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  // Audio Playback Hook
  const {
    playChunk,
    stop: stopPlayback,
    scheduleAfterPlayback,
    waitForDrain,
    cancelDrain,
  } = useAudioPlayback();

  const audioCompleteCalledRef = useRef(false);
  const audioCompleteSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const callAudioComplete = useCallback(async () => {
    if (audioCompleteCalledRef.current || !token) return;
    audioCompleteCalledRef.current = true;
    cancelDrain();
    if (audioCompleteSafetyTimerRef.current) {
      clearTimeout(audioCompleteSafetyTimerRef.current);
      audioCompleteSafetyTimerRef.current = null;
    }
    try {
      await sessionsApi.audioComplete(token);
    } catch {
      // Retry safely
      setTimeout(() => sessionsApi.audioComplete(token).catch(() => {}), 2000);
    }
  }, [token, cancelDrain]);

  // Handle WebSocket state changes
  const handleStateChange = useCallback(
    (state: InterviewState) => {
      setInterviewState(state);

      if (state === "draining_audio") {
        muteRef.current?.();
        audioCompleteCalledRef.current = false;
        audioCompleteSafetyTimerRef.current = setTimeout(() => {
          callAudioComplete();
        }, 10_000);
        waitForDrain(() => callAudioComplete());
        return;
      }

      if (state === "reconnecting") {
        muteRef.current?.();
      } else if (state === "active" && !micMutedRef.current) {
        unmuteRef.current?.();
      }
    },
    [callAudioComplete, waitForDrain]
  );

  const handleReconnected = useCallback(() => {
    toast({
      title: lang === "id" ? "Koneksi pulih" : "Reconnected",
      description:
        lang === "id"
          ? "Silakan ucapkan 'cek' atau lanjutkan jawaban Anda."
          : "Please say 'check' or continue your answer.",
      type: "info",
    });
  }, [lang, toast]);

  const handleTranscript = useCallback((turn: Pick<TranscriptTurn, "speaker" | "text">) => {
    setTranscript((prev) => [...prev.slice(-19), turn]);
  }, []);

  const handleSpeakerChange = useCallback(
    (newSpeaker: InterviewSpeaker) => {
      if (newSpeaker === "ai") {
        setSpeaker("ai");
        muteRef.current?.();
      } else if (newSpeaker === "candidate") {
        scheduleAfterPlayback(() => {
          setSpeaker("candidate");
          if (!micMutedRef.current) unmuteRef.current?.();
        });
      }
    },
    [scheduleAfterPlayback]
  );

  const { connect, send, sendJson, disconnect, connectionState } = useAudioWebSocket({
    sessionId: candidateInfo?.session_id ?? 0,
    token,
    onAudioChunk: playChunk,
    onTranscript: handleTranscript,
    onStateChange: handleStateChange,
    onSpeakerChange: handleSpeakerChange,
    onReconnected: handleReconnected,
  });

  const { start: startCapture, stop: stopCapture, mute, unmute } = useAudioCapture({
    onFrame: send,
  });

  muteRef.current = mute;
  unmuteRef.current = unmute;

  const toggleMic = useCallback(() => {
    if (micMutedRef.current) {
      micMutedRef.current = false;
      setMicMuted(false);
      unmute();
    } else {
      micMutedRef.current = true;
      setMicMuted(true);
      mute();
    }
  }, [mute, unmute]);

  // Stage Transitions
  const handleProceedToDeviceCheck = async () => {
    setStage("device_check");
    if (token) {
      sessionsApi.updateProgress(token, { stage: "device_check", consent_accepted: true }).catch(() => {});
    }
  };

  const handleStartLive = async () => {
    setStage("live");
    setInterviewState("connecting");
    if (token) {
      sessionsApi.updateProgress(token, { stage: "live", device_check_passed: true }).catch(() => {});
    }
    connect();
    await startCapture();
    muteRef.current?.();
  };

  const handleEndInterview = useCallback(async () => {
    setInterviewState("ending");
    stopCapture();
    stopPlayback();
    sendJson({ type: "end_session" });
    disconnect();
    setStage("complete");
    setInterviewState("complete");
    if (token) {
      sessionsApi.updateProgress(token, { stage: "complete" }).catch(() => {});
    }
  }, [stopCapture, stopPlayback, sendJson, disconnect, token]);

  const toggleLang = () => {
    setLang((prev) => (prev === "en" ? "id" : "en"));
  };

  // Render Loading / Error States
  if (loadingInfo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (loadError || !candidateInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background text-center">
        <div className="max-w-md border border-destructive/30 bg-destructive/5 rounded-2xl p-8 space-y-4 shadow-sm">
          <div className="p-3 rounded-full bg-destructive/10 text-destructive w-12 h-12 mx-auto flex items-center justify-center">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-destructive">Invalid Interview Link</h2>
            <p className="text-xs text-muted-foreground">{loadError}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchInfo} className="mt-2">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const t = candidateTranslations[lang];

  // Determine Speaker Status for VoiceOrb
  let orbSpeaker: OrbSpeaker = "idle";
  if (interviewState === "connecting") orbSpeaker = "connecting";
  else if (speaker === "ai") orbSpeaker = "ai";
  else if (speaker === "candidate") orbSpeaker = "candidate";

  const orbLabel =
    orbSpeaker === "ai"
      ? t.live.aiSpeaking
      : orbSpeaker === "candidate"
      ? t.live.youSpeaking
      : orbSpeaker === "connecting"
      ? t.live.connecting
      : t.live.listening;

  return (
    <div
      className={cn(
        stage === "live" ? "h-screen max-h-screen overflow-hidden" : "min-h-screen",
        "flex flex-col bg-background text-foreground relative"
      )}
    >
      {/* Top Navbar / Stepper for non-live screens */}
      {stage !== "live" && (
        <header className="border-b bg-background/95 px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
          <span className="font-bold text-sm text-primary tracking-tight">Rakamin AI Interview</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleLang} className="h-8 px-2 text-xs font-semibold">
              {lang.toUpperCase()}
            </Button>
            <ThemeToggle />
          </div>
        </header>
      )}

      {/* Stepper Indicator */}
      {stage !== "live" && stage !== "complete" && (
        <div className="pt-4 px-4">
          <CandidateStepper currentStep={stage} labels={t.stepper} />
        </div>
      )}

      {/* Top Status Header for Live stage */}
      {stage === "live" && (
        <CandidateStatusHeader
          totalSeconds={(candidateInfo.time_limit_min || 45) * 60}
          running={interviewState === "active" || interviewState === "connecting"}
          onExpired={handleEndInterview}
          onEndEarly={handleEndInterview}
          connectionState={
            interviewState === "reconnecting"
              ? "reconnecting"
              : connectionState === "connected"
              ? "connected"
              : "reconnecting"
          }
          micMuted={micMuted}
          onToggleMic={toggleMic}
          transcriptOpen={transcriptOpen}
          onToggleTranscript={() => setTranscriptOpen((prev) => !prev)}
          lang={lang}
          onToggleLang={toggleLang}
        />
      )}

      {/* Main Content Area */}
      <main
        className={cn(
          "flex-1 flex flex-col w-full",
          stage === "live" ? "overflow-hidden min-h-0 p-2.5 sm:p-4" : "p-4"
        )}
      >
        {/* Step 1: Welcome */}
        {stage === "welcome" && (
          <WelcomeStep
            info={candidateInfo}
            lang={lang}
            onProceed={handleProceedToDeviceCheck}
            onResume={handleStartLive}
          />
        )}

        {/* Step 2: Device Check */}
        {stage === "device_check" && (
          <DeviceCheckStep
            lang={lang}
            onReady={handleStartLive}
            onBack={() => setStage("welcome")}
          />
        )}

        {/* Step 3: Live Interview Screen (Strictly non-scrollable, fits 100vh) */}
        {stage === "live" && (
          <div className="max-w-3xl mx-auto w-full flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
            {/* Audio Visualizer Area on Top */}
            <div className="shrink-0 flex items-center justify-center">
              <VoiceOrb speaker={orbSpeaker} label={orbLabel} compact={true} />
            </div>

            {/* Live Transcript Directly Below */}
            {transcriptOpen && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden pb-1">
                <CollapsibleTranscript
                  isOpen={transcriptOpen}
                  turns={transcript}
                  emptyText={t.live.noTranscriptYet}
                  variant="inline"
                  className="flex-1 min-h-0 h-full"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 4: Selesai */}
        {stage === "complete" && (
          <CompleteStep
            lang={lang}
            candidateName={candidateInfo.candidate_name}
            roleTitle={candidateInfo.role_title}
          />
        )}
      </main>
    </div>
  );
}
