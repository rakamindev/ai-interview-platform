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
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import VoiceBars from "@/components/interview/VoiceBars";
import InterviewTimer from "@/components/interview/InterviewTimer";
import ConnectionStatus from "@/components/interview/ConnectionStatus";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioLevels } from "@/hooks/useAudioLevels";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { sessionsApi } from "@/services/sessions";
import HardwareCheck from "@/components/HardwareCheck";
import { CheckCircle, Check, Mic, MicOff, X, Zap, UnplugIcon } from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";
import { m } from "@/paraglide/messages.js";
import { Separator } from "@/components/ui/separator";

// Mirrors Gemini::LiveClient::CANDIDATE_SILENCE_BUFFER_MS (api/app/clients/gemini/live_client.rb) —
// no shared config between frontend/backend today, keep these in sync by hand.
const SILENCE_BUFFER_SECONDS = 25;
const SILENCE_WARNING_AT_SECONDS = 10;
// Any candidate frequency-bar level above this counts as "still speaking" for the silence timer.
const SPEECH_LEVEL_THRESHOLD = 0.05;

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [interimAiTranscript, setInterimAiTranscript] = useState("");
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false); // kept for green banner
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);
  const [audioCaptureError, setAudioCaptureError] = useState<string | null>(null);
  // True right after "I'm done" is clicked, until the AI actually takes the turn — distinguishes
  // "answer submitted, waiting on AI" from the genuine mic-still-initializing state at turn start.
  const [awaitingResponse, setAwaitingResponse] = useState(false);

  // Fetch candidate info
  useEffect(() => {
    if (!token) return;
    sessionsApi
      .getCandidateInfo(token)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        if (res.data.session_status === "ended") setInterviewState("complete");
        return;
      })
      .catch(() => setInterviewState("complete"));
  }, [token]);

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  const {
    playChunk,
    stop: stopPlayback,
    scheduleAfterPlayback,
    waitForDrain,
    cancelDrain,
    analyserRef: playbackAnalyserRef
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
    // Retry until success — endpoint now always returns ended:true or an error.
    // ended:false is no longer a valid response; any success means the session ended.
    const attempt = async (delay: number) => {
      try {
        await sessionsApi.audioComplete(token);
      } catch {
        setTimeout(() => attempt(Math.min(delay * 2, 8000)), delay);
      }
    };
    attempt(2000);
  }, [token, cancelDrain]);

  const handleStateChange = useCallback(
    (state: InterviewState) => {
      setInterviewState(state);

      if (state === "draining_audio") {
        // Mute mic, stop sending — wait for audio queue to drain then call audio_complete
        muteRef.current?.();
        setAwaitingResponse(false);
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
        setAwaitingResponse(false);
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
    [waitForDrain, callAudioComplete]
  );

  const handleReconnected = useCallback(() => {
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    setReconnectedPrompt(true);
    reconnectedPromptTimerRef.current = setTimeout(() => setReconnectedPrompt(false), 10_000);
  }, []);

  const handleTranscript = useCallback((turn: Pick<TranscriptTurn, "speaker" | "text">) => {
    setTranscript((prev) => [...prev.slice(-9), turn]); // keep last 10
    if (turn.speaker === "candidate") setInterimTranscript("");
    else if (turn.speaker === "assessor") setInterimAiTranscript("");
  }, []);

  const handleTranscriptPartial = useCallback(
    (partial: { speaker: "candidate" | "ai"; text: string }) => {
      if (partial.speaker === "candidate") setInterimTranscript(partial.text);
      else setInterimAiTranscript(partial.text);
    },
    []
  );

  const handleSpeakerChange = useCallback(
    (newSpeaker: InterviewSpeaker) => {
      if (newSpeaker === "ai") {
        setSpeaker("ai");
        setAwaitingResponse(false);
        muteRef.current?.();
        setInterimTranscript("");
      } else if (newSpeaker === "candidate") {
        setInterimAiTranscript("");
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
    onTranscriptPartial: handleTranscriptPartial,
    onStateChange: handleStateChange,
    onSpeakerChange: handleSpeakerChange,
    onReconnected: handleReconnected
  });

  const {
    start: startCapture,
    stop: stopCapture,
    mute,
    unmute,
    isSending: captureSending,
    analyserRef: captureAnalyserRef
  } = useAudioCapture({
    onFrame: send,
    onError: (error) => {
      const denied = error.name === "NotAllowedError";
      setAudioCaptureError(
        denied
          ? "Microphone access was blocked. Enable it in your browser's site settings for this page, then reload."
          : "Couldn't access your microphone. Check that it's connected and not in use by another app."
      );
      disconnect();
      setHardwareCheckDone(false);
      setInterviewState("idle");
    }
  });

  muteRef.current = mute;
  unmuteRef.current = unmute;

  const aiLevels = useAudioLevels(playbackAnalyserRef.current, speaker === "ai");
  const micIsCapturingNow = speaker === "candidate" && !micMuted && captureSending;
  const candidateLevels = useAudioLevels(captureAnalyserRef.current, micIsCapturingNow);

  // Mirrors Gemini's own silence-buffer VAD (see SILENCE_BUFFER_SECONDS) purely for UI feedback —
  // doesn't drive turn completion itself, Gemini's realtimeInputConfig does that server-side.
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);
  const lastCandidateSoundAtRef = useRef<number>(Date.now());
  const candidateLevelsRef = useRef<number[]>(candidateLevels);
  candidateLevelsRef.current = candidateLevels;

  useEffect(() => {
    if (!micIsCapturingNow) {
      setSilenceCountdown(null);
      return;
    }

    lastCandidateSoundAtRef.current = Date.now();

    const interval = setInterval(() => {
      const speaking = candidateLevelsRef.current.some((level) => level > SPEECH_LEVEL_THRESHOLD);
      if (speaking) {
        lastCandidateSoundAtRef.current = Date.now();
      }

      const silenceSeconds = (Date.now() - lastCandidateSoundAtRef.current) / 1000;
      if (silenceSeconds >= SILENCE_WARNING_AT_SECONDS) {
        setSilenceCountdown(Math.max(0, Math.ceil(SILENCE_BUFFER_SECONDS - silenceSeconds)));
      } else {
        setSilenceCountdown(null);
      }
    }, 500);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micIsCapturingNow]);

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
    setAudioCaptureError(null);
    setInterviewState("connecting");
    connect();
    await startCapture();
    // Start muted — only unmute when backend sends speaker_changed: candidate.
    // This prevents mic audio from being sent during AI speech, since separate
    // AudioContexts for capture/playback break the browser's echo cancellation.
    muteRef.current?.();
  }, [sessionId, connect, startCapture]);

  const submitAnswer = useCallback(() => {
    setAwaitingResponse(true);
    sendJson({ type: "end_turn" });
    muteRef.current?.();
  }, [sendJson]);

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

  // ── State A: Pre-start ──────────────────────────────────────────────────
  if (interviewState === "idle") {
    return (
      <main className="max-w-2xl w-full mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">
            {candidateInfo?.role_title ?? m.interview_title()}
          </h1>
          {candidateInfo && (
            <p className="text-sm text-muted-foreground">{candidateInfo.time_limit_min} minutes</p>
          )}
        </div>

        {audioCaptureError && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2.5">
            <span>{audioCaptureError}</span>
          </div>
        )}

        {!hardwareCheckDone ? (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1.5 text-muted-foreground">
              <p>• {m.interview_tip_1()}</p>
              <p>• {m.interview_tip_2()}</p>
              <p>• {m.interview_tip_3()}</p>
            </div>
            <HardwareCheck
              onStart={() => {
                setHardwareCheckDone(true);
                startInterview();
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>Hardware checks passed. You're ready to start.</span>
            </div>
            <Button className="w-full" size="lg" onClick={startInterview}>
              <Mic className="h-4 w-4 mr-2" />
              {m.interview_start()}
            </Button>
          </div>
        )}
      </main>
    );
  }

  // ── State F: Complete ───────────────────────────────────────────────────
  if (interviewState === "complete") {
    return (
      <main className="max-w-2xl w-full mx-auto px-4 py-16 text-center space-y-4 flex flex-col items-center">
        <CheckCircle className="h-10 w-10 text-green-500" />
        <h2 className="text-xl font-semibold">{m.interview_complete()}</h2>
        <p className="text-sm text-muted-foreground">{m.interview_complete_thank()}</p>
      </main>
    );
  }

  // ── States B/C/D/E: Active interview ────────────────────────────────────
  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";
  // Mic is only truly streaming audio when: it's the candidate's turn, the user
  // hasn't muted it themselves, and the capture gate (server-driven) is open.
  const micActuallyCapturing = candidateSpeaking && !micMuted && captureSending;
  const listeningLabel = micMuted
    ? m.interview_muted()
    : candidateSpeaking
      ? micActuallyCapturing
        ? m.interview_listening()
        : awaitingResponse
          ? m.interview_submitting()
          : m.interview_connecting_mic()
      : m.interview_waiting_turn();

  return (
    <main className="max-w-2xl w-full mx-auto px-4 flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between py-3 border-b sticky top-12 bg-background z-10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {candidateInfo?.role_title ?? m.interview_title()}
          </span>
          <Separator orientation="vertical" className="h-4" />
          <ConnectionStatus state={wsConnectionStatus} />
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
      {interviewState === "reconnecting" &&
        (connectionLostLong ? (
          <div className="flex items-center gap-2 text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-2.5 mt-2">
            <span className="animate-pulse">●</span>
            <span>
              Connection is taking too long to restore. Please wait, and contact the interviewer if
              this persists.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-2.5 mt-2">
            <span className="animate-pulse">●</span>
            <span>Briefly reconnecting — please wait a moment.</span>
          </div>
        ))}

      {/* Reconnected prompt */}
      {reconnectedPrompt && (
        <div className="flex items-center justify-between text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-2.5 mt-2">
          <span>
            Reconnected — please say <strong>"check"</strong> or continue your answer to resume.
          </span>
          <button
            className="ml-3 text-blue-500 hover:text-blue-700 shrink-0"
            onClick={() => setReconnectedPrompt(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Voice indicator */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
        {interviewState === "connecting" ? (
          <div className="text-sm text-muted-foreground animate-pulse">
            {m.interview_connecting()}
          </div>
        ) : interviewState === "draining_audio" ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <VoiceBars active={true} label="AI speaking" variant="ai" levels={aiLevels} />
            <p className="text-xs text-muted-foreground">{m.interview_wrapping_up()}</p>
          </div>
        ) : (
          <>
            <VoiceBars
              active={aiSpeaking}
              label={aiSpeaking ? "AI speaking" : listeningLabel}
              variant="ai"
              levels={aiLevels}
            />

            {candidateSpeaking && (
              <VoiceBars
                active={micActuallyCapturing}
                label={micActuallyCapturing ? "You're speaking" : listeningLabel}
                variant="candidate"
                levels={candidateLevels}
              />
            )}

            {silenceCountdown !== null && (
              <p className="text-xs text-muted-foreground animate-pulse">
                Submitting your answer in {silenceCountdown}s — keep talking to continue.
              </p>
            )}

            {/* Transcript */}
            {(transcript.length > 0 || interimTranscript || interimAiTranscript) && (
              <div className="w-full space-y-2 overflow-y-auto max-h-[60vh]">
                {transcript.map((turn) => (
                  <TranscriptBubble
                    key={`${turn.speaker}-${turn.text.slice(0, 20)}`}
                    speaker={turn.speaker}
                    text={turn.text}
                  />
                ))}
                {interimTranscript && (
                  <TranscriptBubble speaker="candidate" text={interimTranscript} interim />
                )}
                {interimAiTranscript && (
                  <TranscriptBubble speaker="ai" text={interimAiTranscript} interim />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t py-3 flex items-center justify-between gap-4 sticky bottom-0 bg-background">
        <Button variant={micMuted ? "destructive" : "outline"} size="sm" onClick={toggleMic}>
          {micMuted ? (
            <>
              <MicOff className="h-3.5 w-3.5 mr-1.5" /> Muted
            </>
          ) : (
            <>
              <Mic className="h-3.5 w-3.5 mr-1.5" />
              {micActuallyCapturing ? m.interview_mic_on() : m.interview_mic_paused()}
            </>
          )}
        </Button>

        {candidateSpeaking && (
          <Button
            variant="default"
            size="sm"
            onClick={submitAnswer}
            disabled={!micActuallyCapturing}
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            {m.interview_im_done()}
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              <UnplugIcon className="h-3.5 w-3.5 mr-1.5" />
              {m.interview_end_interview()}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{m.interview_end_confirm()}</AlertDialogTitle>
              <AlertDialogDescription>{m.interview_end_confirm_desc()}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={endInterview}>
                {m.interview_end_interview()}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {import.meta.env.DEV && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs opacity-50"
            onClick={() => sendJson({ type: "debug_force_reconnect" })}
          >
            <Zap className="h-4 w-4" /> Force reconnect
          </Button>
        )}
      </div>
    </main>
  );
}
