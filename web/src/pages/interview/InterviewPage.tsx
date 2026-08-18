import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import VoiceBars from "@/components/interview/VoiceBars";
import InterviewTimer from "@/components/interview/InterviewTimer";
import ConnectionStatus from "@/components/interview/ConnectionStatus";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { sessionsApi } from "@/services/sessions";
import HardwareCheck from "@/components/HardwareCheck";
import { CheckCircle, Loader2, Mic, MicOff, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

// ── Interview Complete Screen (extracted for clarity) ─────────────────────

type PortfolioStatus = "pending" | "generating" | "complete" | "failed" | "unknown";

function InterviewCompleteScreen({
  sessionId,
  token,
}: {
  sessionId: number | null;
  token?: string;
}) {
  const [portfolioStatus, setPortfolioStatus] = useState<PortfolioStatus>("pending");

  // Poll portfolio status every 4s until complete/failed
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await sessionsApi.getPortfolio(sessionId);
        const data = res.data as any;
        const status: PortfolioStatus =
          data?.portfolio?.generation_status ?? data?.status ?? "unknown";
        if (!cancelled) setPortfolioStatus(status);
      } catch {
        if (!cancelled) setPortfolioStatus("unknown");
      }
    };

    check();
    const interval = setInterval(() => {
      if (portfolioStatus === "complete" || portfolioStatus === "failed") return;
      check();
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const isReady = portfolioStatus === "complete";
  const isFailed = portfolioStatus === "failed";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Check mark */}
        <div className="relative mx-auto w-16 h-16">
          <div className="absolute inset-0 rounded-full bg-green-100 animate-ping opacity-20" />
          <div className="relative rounded-full bg-green-100 w-16 h-16 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-1.5">
          <h2 className="text-xl font-semibold">Interview Complete</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Thank you for your time. Your responses have been recorded.
          </p>
        </div>

        {/* What happens next */}
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-left space-y-1.5">
          <p className="font-medium text-foreground">What happens next</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your responses have been submitted. The assessment team will review your results and contact you regarding next steps.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Step indicator shown during idle/hardware check ───────────────────────
function StepDots({ current }: { current: 0 | 1 }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      {[0, 1].map((i) => (
        <div
          key={i}
          className={cn(
            "h-2 rounded-full transition-all duration-300",
            i === current ? "w-5 bg-primary" : "w-2 bg-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();

  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false);
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const [micMuted, setMicMuted] = useState(false);

  const micMutedRef = useRef(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCompleteCalledRef = useRef(false);
  const audioCompleteSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  // Fetch candidate info
  useEffect(() => {
    if (!token) return;
    sessionsApi
      .getCandidateInfo(token)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        if (res.data.session_status === "ended") setInterviewState("complete");
      })
      .catch(() => setInterviewState("complete"));
  }, [token]);

  const handleStateChange = useCallback((state: InterviewState) => {
    setInterviewState(state);

    if (state === "draining_audio") {
      muteRef.current?.();
      audioCompleteCalledRef.current = false;
      audioCompleteSafetyTimerRef.current = setTimeout(() => callAudioComplete(), 10_000);
      waitForDrain(() => callAudioComplete());
      return;
    }

    if (state === "reconnecting") {
      muteRef.current?.();
      connectionLostTimerRef.current = setTimeout(() => setConnectionLostLong(true), 60_000);
    } else {
      if (connectionLostTimerRef.current) {
        clearTimeout(connectionLostTimerRef.current);
        connectionLostTimerRef.current = null;
      }
      setConnectionLostLong(false);
      if (state === "active" && !micMutedRef.current) unmuteRef.current?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReconnected = useCallback(() => {
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    setReconnectedPrompt(true);
    reconnectedPromptTimerRef.current = setTimeout(() => setReconnectedPrompt(false), 10_000);
  }, []);

  const handleTranscript = useCallback((turn: Pick<TranscriptTurn, "speaker" | "text">) => {
    setTranscript((prev) => [...prev.slice(-9), turn]);
  }, []);

  const { playChunk, stop: stopPlayback, scheduleAfterPlayback, waitForDrain, cancelDrain } =
    useAudioPlayback();

  const callAudioComplete = useCallback(async () => {
    if (audioCompleteCalledRef.current || !token) return;
    audioCompleteCalledRef.current = true;
    cancelDrain();
    if (audioCompleteSafetyTimerRef.current) {
      clearTimeout(audioCompleteSafetyTimerRef.current);
      audioCompleteSafetyTimerRef.current = null;
    }
    const attempt = async (delay: number) => {
      try {
        await sessionsApi.audioComplete(token);
      } catch {
        setTimeout(() => attempt(Math.min(delay * 2, 8000)), delay);
      }
    };
    attempt(2000);
  }, [token, cancelDrain]);

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
    sessionId: sessionId ?? 0,
    token,
    onAudioChunk: playChunk,
    onTranscript: handleTranscript,
    onStateChange: handleStateChange,
    onSpeakerChange: handleSpeakerChange,
    onReconnected: handleReconnected,
  });

  const { start: startCapture, stop: stopCapture, mute, unmute } = useAudioCapture({ onFrame: send });

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

  const startInterview = useCallback(async () => {
    if (!sessionId) return;
    setInterviewState("connecting");
    connect();
    await startCapture();
    muteRef.current?.();
  }, [sessionId, connect, startCapture]);

  const endInterview = useCallback(async () => {
    setInterviewState("ending");
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    stopCapture();
    stopPlayback();
    sendJson({ type: "end_session" });
    disconnect();
    setInterviewState("complete");
  }, [stopCapture, stopPlayback, sendJson, disconnect]);

  const wsConnectionStatus =
    interviewState === "reconnecting"
      ? connectionLostLong
        ? "lost"
        : "reconnecting"
      : connectionState === "connected"
        ? "connected"
        : "reconnecting";

  // ── State: Pre-start (step 1 — briefing) ─────────────────────────────────
  if (interviewState === "idle" && !hardwareCheckDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-6">
          {/* Brand / role */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full mb-2">
              <Radio className="h-3 w-3" />
              AI-powered interview
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {candidateInfo?.role_title ?? "AI Interview"}
            </h1>
            {candidateInfo && (
              <p className="text-sm text-muted-foreground">
                {candidateInfo.time_limit_min} minute voice session
              </p>
            )}
          </div>

          <StepDots current={0} />

          {/* Briefing card */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/40">
              <p className="text-sm font-medium">Before you begin</p>
            </div>
            <ul className="px-5 py-4 space-y-3">
              {[
                "Find a quiet place — this is a voice interview",
                "The AI will ask follow-up questions, there is no script",
                `You have up to ${candidateInfo?.time_limit_min ?? "—"} minutes`,
                "Your microphone will stay active throughout",
                "You can end the interview early if needed",
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <span className="mt-0.5 h-4 w-4 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center shrink-0 font-semibold">
                    ✓
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => setHardwareCheckDone(true)}
          >
            Continue to system check →
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Your data is handled in accordance with applicable privacy laws.
          </p>
        </div>
      </div>
    );
  }

  // ── State: Hardware check (step 2) ────────────────────────────────────────
  if (interviewState === "idle" && hardwareCheckDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-semibold">System Check</h1>
            <p className="text-sm text-muted-foreground">
              Verifying your connection and audio before we start
            </p>
          </div>

          <StepDots current={1} />

          <HardwareCheck onStart={() => startInterview()} />

          <button
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setHardwareCheckDone(false)}
          >
            ← Back to briefing
          </button>
        </div>
      </div>
    );
  }

  // ── State: Complete ───────────────────────────────────────────────────────
  if (interviewState === "complete") {
    return <InterviewCompleteScreen sessionId={sessionId} token={token} />;
  }

  // ── States: Active interview ──────────────────────────────────────────────
  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";

  return (
    <div className="max-w-xl mx-auto px-4 flex flex-col h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between py-3 border-b sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {candidateInfo?.role_title ?? "AI Interview"}
          </span>
        </div>
        {candidateInfo && (
          <InterviewTimer
            totalSeconds={candidateInfo.time_limit_min * 60}
            running={interviewState === "active"}
            onExpired={endInterview}
          />
        )}
      </div>

      {/* Reconnecting banner */}
      {interviewState === "reconnecting" && (
        <div
          className={cn(
            "flex items-center gap-2 text-sm rounded-lg px-4 py-2.5 mt-2 border",
            connectionLostLong
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          )}
        >
          <span className="animate-pulse">●</span>
          <span>
            {connectionLostLong
              ? "Connection is taking too long to restore. Please wait, and contact the interviewer if this persists."
              : "Briefly reconnecting — please wait a moment."}
          </span>
        </div>
      )}

      {/* Reconnected prompt */}
      {reconnectedPrompt && (
        <div className="flex items-center justify-between text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-2.5 mt-2">
          <span>
            Reconnected — please say <strong>"check"</strong> or continue your answer to resume.
          </span>
          <button
            className="ml-3 text-blue-500 hover:text-blue-700 shrink-0"
            onClick={() => setReconnectedPrompt(false)}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Main voice area ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 py-8">
        {interviewState === "connecting" ? (
          <div className="text-center space-y-3">
            <div className="flex justify-center gap-1">
              {[0, 0.2, 0.4].map((d) => (
                <span
                  key={d}
                  className="h-2 w-2 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${d}s` }}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Connecting to interview…</p>
          </div>
        ) : interviewState === "draining_audio" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <VoiceBars active label="AI speaking" variant="ai" />
            <p className="text-xs text-muted-foreground">Wrapping up…</p>
          </div>
        ) : (
          <div className="w-full space-y-6">
            {/* Speaker indicators — clear hierarchy */}
            <div className="flex flex-col items-center gap-6">
              {/* AI speaker */}
              <div
                className={cn(
                  "w-full rounded-xl border px-6 py-5 flex flex-col items-center gap-3 transition-all duration-300",
                  aiSpeaking
                    ? "border-primary/40 bg-primary/5 shadow-sm"
                    : "border-transparent bg-muted/30 opacity-60"
                )}
              >
                <VoiceBars
                  active={aiSpeaking}
                  label={aiSpeaking ? "AI speaking" : "AI waiting"}
                  variant="ai"
                />
                {aiSpeaking && (
                  <span className="text-[10px] uppercase tracking-widest text-primary font-semibold animate-pulse">
                    Speaking
                  </span>
                )}
              </div>

              {/* Candidate speaker */}
              <div
                className={cn(
                  "w-full rounded-xl border px-6 py-5 flex flex-col items-center gap-3 transition-all duration-300",
                  candidateSpeaking
                    ? "border-green-400/50 bg-green-50 shadow-sm"
                    : "border-transparent bg-muted/30 opacity-60"
                )}
              >
                <VoiceBars
                  active={candidateSpeaking}
                  label={candidateSpeaking ? "Your turn" : "Your turn next"}
                  variant="candidate"
                />
                {candidateSpeaking && (
                  <span className="text-[10px] uppercase tracking-widest text-green-700 font-semibold animate-pulse">
                    Listening
                  </span>
                )}
              </div>
            </div>

            {/* Transcript */}
            {transcript.length > 0 && (
              <div className="space-y-2 overflow-y-auto max-h-[30vh] rounded-lg border bg-background p-3">
                {transcript.map((turn, i) => (
                  <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t py-3 flex items-center justify-between gap-4 sticky bottom-0 bg-white">
        <ConnectionStatus state={wsConnectionStatus} />

        <div className="flex items-center gap-2">
          <Button
            variant={micMuted ? "destructive" : "outline"}
            size="sm"
            onClick={toggleMic}
            className="gap-1.5"
          >
            {micMuted ? (
              <><MicOff className="h-3.5 w-3.5" /> Muted</>
            ) : (
              <><Mic className="h-3.5 w-3.5" /> Mic on</>
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                End Interview
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End the interview?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to end the interview early? Your responses so far will still be recorded.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={endInterview}>End interview</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {import.meta.env.DEV && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs opacity-40"
              onClick={() => sendJson({ type: "debug_force_reconnect" })}
            >
              ⚡
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
