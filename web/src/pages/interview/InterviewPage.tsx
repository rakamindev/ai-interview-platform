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
import SystemCheckScreen from "@/components/SystemCheckScreen";
import { BackButton } from "@/components/common/BackButton";
import CvUploadScreen from "@/components/interview/CvUploadScreen";
import { AlertTriangle, CheckCircle, Mic, MicOff, RotateCw } from "lucide-react";
import type {
  CandidateInfo,
  InterviewState,
  InterviewSpeaker,
  TranscriptTurn,
  InterviewExit,
} from "@/types";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false); // kept for green banner
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);

  // Non-null only when the interview left the normal flow WITHOUT a
  // server-confirmed ending. Drives the "failed" screen — never the tick.
  const [exit, setExit] = useState<InterviewExit | null>(null);
  const [submitRetrying, setSubmitRetrying] = useState(false);
  const [loadingRetrying, setLoadingRetrying] = useState(false);

  // Wired up to stopCapture/stopPlayback/disconnect once those hooks run.
  const cleanupRef = useRef<(() => void) | null>(null);
  const disconnectRef = useRef<(() => void) | null>(null);
  const endSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearEndSafetyTimer = useCallback(() => {
    if (endSafetyTimerRef.current) {
      clearTimeout(endSafetyTimerRef.current);
      endSafetyTimerRef.current = null;
    }
  }, []);

  /**
   * Records that the interview ended without server confirmation. Stops all
   * audio/sockets and switches to the failure screen. Never show a tick here.
   */
  const failExit = useCallback(
    (info: InterviewExit) => {
      clearEndSafetyTimer();
      setExit(info);
      setInterviewState("failed");
      cleanupRef.current?.();
    },
    [clearEndSafetyTimer]
  );

  /**
   * Records a server-confirmed ending: either an explicit session_ended frame
   * from the backend or a 200 from the idempotent audio_complete endpoint.
   */
  const confirmCompletion = useCallback(() => {
    clearEndSafetyTimer();
    setExit(null);
    setInterviewState("complete");
    cleanupRef.current?.();
    disconnectRef.current?.();
  }, [clearEndSafetyTimer]);

  const loadCandidateInfo = useCallback(async () => {
    if (!token) {
      failExit({
        kind: "link_invalid",
        message: "This link is missing its interview code.",
        retryable: false,
      });
      return;
    }
    setLoadingRetrying(true);
    try {
      const res = await sessionsApi.getCandidateInfo(token);
      setCandidateInfo(res.data);
      setSessionId(res.data.session_id);
      setExit(null);
      // Resume the flow: "complete" if the server says it already ended,
      // otherwise back to the pre-start screen (a no-op on first load).
      setInterviewState(res.data.session_status === "ended" ? "complete" : "idle");
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 410 || status === 401 || status === 403) {
        // No amount of retrying helps: the invite token is unknown/revoked.
        failExit({
          kind: "link_invalid",
          message: "This link may have expired or already been used.",
          retryable: false,
        });
      } else {
        failExit({
          kind: "load_failed",
          message: "We couldn't reach the interview service. Nothing has been lost.",
          retryable: true,
        });
      }
    } finally {
      setLoadingRetrying(false);
    }
  }, [token, failExit]);

  useEffect(() => {
    void loadCandidateInfo();
  }, [loadCandidateInfo]);

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  const { playChunk, stop: stopPlayback, scheduleAfterPlayback, waitForDrain, cancelDrain } = useAudioPlayback();
  const audioCompleteCalledRef = useRef(false);
  const audioCompleteSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStateChange = useCallback(
    (state: InterviewState) => {
      setInterviewState(state);

      // "complete" is only ever sent from a server-confirmed ending
      // (session_ended frame) or from our own confirmed audio_complete call.
      if (state === "complete") {
        clearEndSafetyTimer();
        if (audioCompleteSafetyTimerRef.current) {
          clearTimeout(audioCompleteSafetyTimerRef.current);
          audioCompleteSafetyTimerRef.current = null;
        }
        if (connectionLostTimerRef.current) {
          clearTimeout(connectionLostTimerRef.current);
          connectionLostTimerRef.current = null;
        }
        setConnectionLostLong(false);
        setExit(null);
        cleanupRef.current?.();
        disconnectRef.current?.();
        return;
      }

      if (state === "draining_audio") {
        // Mute mic, stop sending — wait for audio queue to drain then call audio_complete
        muteRef.current?.();
        audioCompleteCalledRef.current = false;
        // Safety timeout: call audio_complete after 10s even if drain never fires
        audioCompleteSafetyTimerRef.current = setTimeout(() => {
          callAudioComplete();
        }, 10_000);
        waitForDrain(() => callAudioComplete());
        return;
      }

      if (state === "reconnecting") {
        muteRef.current?.();
        connectionLostTimerRef.current = setTimeout(() => {
          setConnectionLostLong(true);
        }, 60_000);
      } else {
        if (connectionLostTimerRef.current) {
          clearTimeout(connectionLostTimerRef.current);
          connectionLostTimerRef.current = null;
        }
        setConnectionLostLong(false);
        if (state === "active" && !micMutedRef.current) unmuteRef.current?.();
      }
    },
    [clearEndSafetyTimer]
  );

  const handleReconnected = useCallback(() => {
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    setReconnectedPrompt(true);
    reconnectedPromptTimerRef.current = setTimeout(() => setReconnectedPrompt(false), 10_000);
  }, []);

  const handleTranscript = useCallback((turn: Pick<TranscriptTurn, "speaker" | "text">) => {
    setTranscript((prev) => [...prev.slice(-9), turn]); // keep last 10
  }, []);


  const AUDIO_COMPLETE_MAX_ATTEMPTS = 5;

  /**
   * Tells the backend the interview ended. Bounded retries: never an infinite
   * loop. Considers a confirmed 2xx (including "already ended") as the one and
   * only thing that justifies the "Interview Complete" screen.
   */
  const callAudioComplete = useCallback(async () => {
    if (audioCompleteCalledRef.current || !token) return;
    audioCompleteCalledRef.current = true;
    cancelDrain();
    if (audioCompleteSafetyTimerRef.current) {
      clearTimeout(audioCompleteSafetyTimerRef.current);
      audioCompleteSafetyTimerRef.current = null;
    }

    for (let attempt = 1; attempt <= AUDIO_COMPLETE_MAX_ATTEMPTS; attempt++) {
      try {
        await sessionsApi.audioComplete(token);
        confirmCompletion();
        return;
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        // 401/403/404 mean the invite token is not usable — retrying can never
        // succeed and would keep a candidate looping forever.
        if (status === 404 || status === 410 || status === 401 || status === 403) {
          failExit({
            kind: "link_invalid",
            message: "This link may have expired, so we couldn't save this session.",
            retryable: false,
          });
          return;
        }
        if (attempt < AUDIO_COMPLETE_MAX_ATTEMPTS) {
          const delay = Math.min(1000 * 2 ** attempt, 8000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    failExit({
      kind: "submit_failed",
      message: "We couldn't tell the interview service that you finished.",
      retryable: true,
    });
  }, [token, cancelDrain, confirmCompletion, failExit]);

  const handleSpeakerChange = useCallback((newSpeaker: InterviewSpeaker) => {
    if (newSpeaker === "ai") {
      setSpeaker("ai");
      muteRef.current?.();
    } else if (newSpeaker === "candidate") {
      scheduleAfterPlayback(() => {
        setSpeaker("candidate");
        if (!micMutedRef.current) unmuteRef.current?.();
      });
    }
  }, [scheduleAfterPlayback]);

  /**
   * Failure funnel for the WebSocket hook. Deliberately drops the backend's
   * raw message before it can reach the candidate and maps to plain language.
   */
  const handleFailure = useCallback(
    (info: { reason: "connection_lost" | "server_error"; message?: string }) => {
      if (import.meta.env.DEV && info.message) {
        // Development diagnostics only — never rendered in the UI.
        console.warn("[interview] unrecoverable ws frame:", info.message);
      }
      failExit(
        info.reason === "server_error"
          ? {
              kind: "server_error",
              message: "The interview service ran into a problem it couldn't recover from.",
              retryable: false,
            }
          : {
              kind: "connection_lost",
              message: "Your connection dropped and we couldn't restore it in time.",
              retryable: true,
            }
      );
    },
    [failExit]
  );

  const {
    connect,
    send,
    sendJson,
    disconnect,
    resetReconnectBudget,
    connectionState,
  } = useAudioWebSocket({
    sessionId: sessionId ?? 0,
    token,
    onAudioChunk: playChunk,
    onTranscript: handleTranscript,
    onStateChange: handleStateChange,
    onSpeakerChange: handleSpeakerChange,
    onStopPlayback: stopPlayback,
    onReconnected: handleReconnected,
    onFailure: handleFailure,
  });

  const { start: startCapture, stop: stopCapture, mute, unmute } = useAudioCapture({
    onFrame: send,
  });

  muteRef.current = mute;
  unmuteRef.current = unmute;
  cleanupRef.current = () => {
    stopCapture();
    stopPlayback();
    cancelDrain();
  };
  disconnectRef.current = disconnect;

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
    // Start muted — only unmute when backend sends speaker_changed: candidate.
    // This prevents mic audio from being sent during AI speech, since separate
    // AudioContexts for capture/playback break the browser's echo cancellation.
    muteRef.current?.();
  }, [sessionId, connect, startCapture]);

  /**
   * HTTP fallback used when the WebSocket can no longer carry an end-session
   * signal. The endpoint is idempotent, so calling it after a successful WS end
   * is harmless ("already ended").
   */
  const confirmViaRest = useCallback(async () => {
    if (!token) {
      failExit({
        kind: "submit_failed",
        message: "This page is missing its interview code.",
        retryable: false,
      });
      return;
    }
    try {
      await sessionsApi.audioComplete(token, "manual_candidate");
      confirmCompletion();
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 410 || status === 401 || status === 403) {
        failExit({
          kind: "link_invalid",
          message: "This link may have expired, so we couldn't save this session.",
          retryable: false,
        });
      } else {
        failExit({
          kind: "submit_failed",
          message: "We couldn't tell the interview service that you finished.",
          retryable: true,
        });
      }
    }
  }, [token, confirmCompletion, failExit]);

  const endInterview = useCallback(async () => {
    setInterviewState("ending");
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    stopCapture();
    stopPlayback();
    const sent = sendJson({ type: "end_session" });

    if (sent) {
      // The backend replies with `session_ended`, which is what actually flips
      // us to the completion screen. Keep a safety net in case that frame never
      // arrives, and never jump straight to "complete" ourselves.
      clearEndSafetyTimer();
      endSafetyTimerRef.current = setTimeout(() => {
        void confirmViaRest();
      }, 5000);
      return;
    }

    // Socket already unusable — fail over to HTTP rather than stranding a
    // candidate on a session the backend still thinks is running.
    await confirmViaRest();
  }, [stopCapture, stopPlayback, sendJson, clearEndSafetyTimer, confirmViaRest]);

  /** Single entry point for every retry affordance on the failure screen. */
  const retryFailedExit = useCallback(async () => {
    if (!exit) return;

    if (exit.kind === "load_failed") {
      await loadCandidateInfo();
      return;
    }

    if (exit.kind === "connection_lost") {
      resetReconnectBudget();
      setExit(null);
      await startInterview();
      return;
    }

    if (exit.kind === "submit_failed") {
      setSubmitRetrying(true);
      try {
        audioCompleteCalledRef.current = false;
        await callAudioComplete();
      } finally {
        setSubmitRetrying(false);
      }
      return;
    }
  }, [exit, loadCandidateInfo, resetReconnectBudget, startInterview, callAudioComplete]);

  const wsConnectionStatus =
    interviewState === "reconnecting"
      ? connectionLostLong ? "lost" : "reconnecting"
      : connectionState === "connected"
      ? "connected"
      : "reconnecting";

  // ── State A: Pre-start ──────────────────────────────────────────────────
  if (interviewState === "idle") {
    // Session details are still loading — show a calm placeholder rather than
    // an empty title and "— minutes".
    if (!candidateInfo && !exit) {
      return (
        <div
          className="max-w-xl mx-auto px-4 py-16 text-center space-y-3"
          aria-live="polite"
        >
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          <p className="text-sm text-muted-foreground">Loading your interview…</p>
        </div>
      );
    }

    return (
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">{candidateInfo?.role_title ?? "AI Interview"}</h1>
          {candidateInfo && (
            <p className="text-sm text-muted-foreground">
              {candidateInfo.time_limit_min} minutes
            </p>
          )}
        </div>

        {!hardwareCheckDone ? (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1.5 text-muted-foreground">
              <p>• This is a voice interview. Make sure you're in a quiet place.</p>
              <p>• The AI will ask follow-up questions — there are no scripts.</p>
              <p>• The session will last up to {candidateInfo?.time_limit_min ?? "—"} minutes.</p>
              <p>• Your mic will be active throughout. You can end anytime.</p>
            </div>
            <SystemCheckScreen onStart={() => { setHardwareCheckDone(true); setInterviewState("cv_upload"); }} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>Hardware checks passed. You're ready to proceed.</span>
            </div>
            <Button className="w-full" size="lg" onClick={() => setInterviewState("cv_upload")}>
              <Mic className="h-4 w-4 mr-2" />
              Continue to CV Step
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── State A.5: CV Upload Step ───────────────────────────────────────────
  if (interviewState === "cv_upload") {
    return (
      <CvUploadScreen
        token={token || ""}
        // "Ready" must mean usable: a stored but unparsed CV (e.g. a scanned PDF)
        // would not personalize the interview, so treat it as not-yet-usable and
        // let the candidate upload a text-based version instead.
        hasExistingCv={candidateInfo?.has_cv_text ?? candidateInfo?.has_cv}
        existingFilename={candidateInfo?.cv_filename}
        onSuccess={() => void startInterview()}
        onSkip={() => void startInterview()}
        onBack={() => setInterviewState("idle")}
      />
    );
  }

  // ── State F0: Failure ──────────────────────────────────────────────────
  // Reached only when the interview ended WITHOUT server confirmation.
  // It must never be possible to land on the success tick from here.
  if (interviewState === "failed") {
    const kind: InterviewExit["kind"] = exit?.kind ?? "connection_lost";
    const titles: Record<InterviewExit["kind"], string> = {
      link_invalid: "This interview link isn't working",
      load_failed: "We couldn't load your interview",
      connection_lost: "Connection lost",
      server_error: "The interview service ran into a problem",
      submit_failed: "We couldn't save your session yet",
    };
    const notes: Record<InterviewExit["kind"], string> = {
      link_invalid:
        "This session has not been recorded as completed. Ask your interviewer for a new link.",
      load_failed:
        "The interview hasn't started, so nothing is missing. Please try again.",
      connection_lost:
        "This session has not been marked as completed. Reconnect to pick up where you left off.",
      server_error:
        "This session has not been marked as completed. Reload the page and try again.",
      submit_failed:
        "Your interview isn't finished yet. Keep this tab open and try again — please don't close it until it succeeds.",
    };
    const retryLabel =
      kind === "connection_lost" ? "Reconnect" : "Try again";

    const userRole = localStorage.getItem("user_role");
    const isAssessor = userRole === "admin" || userRole === "assessor";
    const dashboardTarget = isAssessor ? "/assessments" : "/candidate";

    return (
      <div
        className="max-w-xl mx-auto px-4 py-16 text-center space-y-6"
        role="alert"
        aria-live="assertive"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 border border-amber-200 text-amber-600 shadow-sm">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{titles[kind]}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            {exit?.message ?? notes[kind]}
          </p>
          <p className="text-xs text-muted-foreground">{notes[kind]}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {exit?.retryable && (
            <Button
              size="lg"
              onClick={() => void retryFailedExit()}
              disabled={submitRetrying || loadingRetrying}
              className="w-full sm:w-auto"
            >
              {submitRetrying || loadingRetrying ? (
                <span className="inline-flex items-center gap-2">
                  <RotateCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Working…
                </span>
              ) : (
                retryLabel
              )}
            </Button>
          )}
          <Button variant="outline" size="lg" onClick={() => window.location.reload()} className="w-full sm:w-auto">
            Reload page
          </Button>
          <BackButton
            fallbackPath={dashboardTarget}
            label="Return to Dashboard"
            variant="ghost"
            className="w-full sm:w-auto"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {kind === "submit_failed"
            ? "Keep this page open — your session stays open until the save succeeds."
            : "If this keeps happening, please tell your interviewer."}
        </p>
      </div>
    );
  }

  // ── State F: Complete ───────────────────────────────────────────────────
  // Only reachable after the backend confirmed the ending (session_ended frame,
  // a 2xx from audio_complete, or a session already marked ended on load).
  if (interviewState === "complete") {
    const userRole = localStorage.getItem("user_role");
    const isAssessor = userRole === "admin" || userRole === "assessor";
    const dashboardTarget = isAssessor ? "/assessments" : "/candidate";
    const dashboardLabel = isAssessor ? "Return to Assessment List" : "Return to Candidate Dashboard";

    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6 animate-in fade-in duration-500">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-sm">
          <CheckCircle className="h-8 w-8" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Interview Complete</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            Your session has ended and your responses have been saved.
            <br />
            The hiring team will review them and follow up with you.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Button
            size="lg"
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            onClick={() => window.location.assign(dashboardTarget)}
          >
            {dashboardLabel}
          </Button>

          <BackButton
            fallbackPath={dashboardTarget}
            label="Back to Previous Page"
            variant="outline"
            className="w-full sm:w-auto"
          />
        </div>
      </div>
    );
  }

  // ── States B/C/D/E: Active interview ────────────────────────────────────
  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";

  return (
    <div className="max-w-xl mx-auto px-4 flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between py-3 border-b sticky top-12 bg-white z-10">
        <span className="text-sm font-medium">AI Interview</span>
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
        connectionLostLong ? (
          <div className="flex items-center gap-2 text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-2.5 mt-2">
            <span className="animate-pulse">●</span>
            <span>Connection is taking too long to restore. Please wait, and contact the interviewer if this persists.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-2.5 mt-2">
            <span className="animate-pulse">●</span>
            <span>Briefly reconnecting — please wait a moment.</span>
          </div>
        )
      )}

      {/* Reconnected prompt */}
      {reconnectedPrompt && (
        <div className="flex items-center justify-between text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-2.5 mt-2">
          <span>Reconnected — please say <strong>"check"</strong> or continue your answer to resume.</span>
          <button className="ml-3 text-blue-500 hover:text-blue-700 shrink-0" onClick={() => setReconnectedPrompt(false)}>✕</button>
        </div>
      )}

      {/* Voice indicator */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
        {interviewState === "connecting" ? (
          <div className="text-sm text-muted-foreground animate-pulse">Connecting...</div>
        ) : interviewState === "draining_audio" ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <VoiceBars active={true} label="AI speaking" variant="ai" />
            <p className="text-xs text-muted-foreground">Wrapping up...</p>
          </div>
        ) : (
          <>
            <VoiceBars
              active={aiSpeaking}
              label={aiSpeaking ? "AI speaking" : "Listening..."}
              variant="ai"
            />

            {candidateSpeaking && (
              <VoiceBars
                active={true}
                label="You're speaking"
                variant="candidate"
              />
            )}

            {/* Transcript */}
            {transcript.length > 0 && (
              <div className="w-full space-y-2 overflow-y-auto max-h-[60vh]">
                {transcript.map((turn, i) => (
                  <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t py-3 flex items-center justify-between gap-4 sticky bottom-0 bg-white">
        <ConnectionStatus state={wsConnectionStatus} />

        <div className="flex items-center gap-3">
          <Button
            variant={micMuted ? "destructive" : "outline"}
            size="sm"
            onClick={toggleMic}
          >
            {micMuted ? (
              <><MicOff className="h-3.5 w-3.5 mr-1.5" /> Muted</>
            ) : (
              <><Mic className="h-3.5 w-3.5 mr-1.5" /> Mic On</>
            )}
          </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">End Interview</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>End interview?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to end the interview early?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={endInterview}>End interview</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {import.meta.env.DEV && (
          <Button variant="outline" size="sm" className="text-xs opacity-50"
            onClick={() => sendJson({ type: "debug_force_reconnect" })}>
            ⚡ Force reconnect
          </Button>
        )}
        </div>
      </div>

    </div>
  );
}
