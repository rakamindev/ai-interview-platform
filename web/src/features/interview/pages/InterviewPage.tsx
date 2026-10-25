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
import VoiceBars from "../components/VoiceBars";
import InterviewTimer from "../components/InterviewTimer";
import ConnectionStatus from "../components/ConnectionStatus";
import TranscriptBubble from "../components/TranscriptBubble";
import { useAudioCapture } from "../hooks/useAudioCapture";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import { useAudioWebSocket } from "../hooks/useAudioWebSocket";
import { sessionsApi } from "@/features/evaluation/services/sessions";
import HardwareCheck from "../components/HardwareCheck";
import { CheckCircle, Mic, MicOff, AlertCircle, Send, Loader2 } from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false);
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);

  // Voice turn processing & manual text fallback
  const [processingSpeech, setProcessingSpeech] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const receivedBinaryAudioRef = useRef(false);
  const ttsSpeakingRef = useRef(false);
  const ttsSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendJsonRef = useRef<((payload: object) => void) | null>(null);

  // Fetch candidate info
  useEffect(() => {
    if (!token) return;
    sessionsApi.getCandidateInfo(token)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        if (res.data.session_status === "ended") setInterviewState("complete");
      })
      .catch(() => setInterviewState("complete"));
  }, [token]);

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);
  const resetTurnSpeechRef = useRef<(() => void) | null>(null);

  const stopBrowserTts = useCallback(() => {
    ttsSpeakingRef.current = false;
    if (ttsSafetyTimerRef.current) {
      clearTimeout(ttsSafetyTimerRef.current);
      ttsSafetyTimerRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }, []);

  const speakAiTextWithBrowserTts = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      if (ttsSafetyTimerRef.current) {
        clearTimeout(ttsSafetyTimerRef.current);
        ttsSafetyTimerRef.current = null;
      }
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 1.02;
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("Samantha") ||
              v.name.includes("Google") ||
              v.name.includes("Natural") ||
              v.name.includes("Alex"))
        ) || voices.find((v) => v.lang.startsWith("en"));
      if (preferred) utterance.voice = preferred;

      ttsSpeakingRef.current = true;
      setProcessingSpeech(false);
      setSpeaker("ai");
      muteRef.current?.();

      let finished = false;
      const onFinish = () => {
        if (finished) return;
        finished = true;
        if (ttsSafetyTimerRef.current) {
          clearTimeout(ttsSafetyTimerRef.current);
          ttsSafetyTimerRef.current = null;
        }
        // Wait 300ms so room speaker echo settles before opening the candidate microphone
        setTimeout(() => {
          ttsSpeakingRef.current = false;
          setSpeaker("candidate");
          resetTurnSpeechRef.current?.();
          if (!micMutedRef.current) unmuteRef.current?.();
          sendJsonRef.current?.({ type: "ai_speech_finished" });
        }, 300);
      };

      utterance.onend = onFinish;
      utterance.onerror = onFinish;

      const wordCount = text.trim().split(/\s+/).length;
      const safetyMs = Math.min(14000, Math.max(4000, wordCount * 420));
      ttsSafetyTimerRef.current = setTimeout(onFinish, safetyMs);

      window.speechSynthesis.speak(utterance);
    } catch {
      ttsSpeakingRef.current = false;
      setSpeaker("candidate");
      if (!micMutedRef.current) unmuteRef.current?.();
    }
  }, []);

  const handleStateChange = useCallback((state: InterviewState) => {
    setInterviewState(state);

    if (state === "draining_audio") {
      muteRef.current?.();
      setProcessingSpeech(false);
      audioCompleteCalledRef.current = false;
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
      if (state === "active" && !micMutedRef.current && !ttsSpeakingRef.current) {
        unmuteRef.current?.();
      }
    }
  }, []);

  const handleReconnected = useCallback(() => {
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    setReconnectedPrompt(true);
    reconnectedPromptTimerRef.current = setTimeout(() => setReconnectedPrompt(false), 10_000);
  }, []);

  const handleTranscript = useCallback(
    (turn: Pick<TranscriptTurn, "speaker" | "text">) => {
      setTranscript((prev) => [...prev.slice(-9), turn]);
      if (turn.speaker === "assessor") {
        setProcessingSpeech(false);
        if (!receivedBinaryAudioRef.current) {
          speakAiTextWithBrowserTts(turn.text);
        }
        receivedBinaryAudioRef.current = false;
      } else {
        setProcessingSpeech(false);
      }
    },
    [speakAiTextWithBrowserTts]
  );

  const { playChunk, stop: stopPlayback, scheduleAfterPlayback, waitForDrain, cancelDrain } =
    useAudioPlayback();
  const audioCompleteCalledRef = useRef(false);
  const audioCompleteSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAudioChunk = useCallback(
    (buffer: ArrayBuffer) => {
      receivedBinaryAudioRef.current = true;
      playChunk(buffer);
    },
    [playChunk]
  );

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
        if (ttsSpeakingRef.current) return; // Let browser TTS finish speaking first
        scheduleAfterPlayback(() => {
          setSpeaker("candidate");
          setProcessingSpeech(false);
          resetTurnSpeechRef.current?.();
          if (!micMutedRef.current) unmuteRef.current?.();
        });
      }
    },
    [scheduleAfterPlayback]
  );

  const { connect, send, sendJson, disconnect, connectionState } = useAudioWebSocket({
    sessionId: sessionId ?? 0,
    token,
    onAudioChunk: handleAudioChunk,
    onTranscript: handleTranscript,
    onStateChange: handleStateChange,
    onSpeakerChange: handleSpeakerChange,
    onReconnected: handleReconnected,
    onError: (msg) => setErrorMessage(msg),
  });

  sendJsonRef.current = sendJson;

  const finishSpokenTurn = useCallback(() => {
    if (ttsSpeakingRef.current || processingSpeech) return;
    setProcessingSpeech(true);
    muteRef.current?.();
    resetTurnSpeechRef.current?.();
    sendJsonRef.current?.({ type: "candidate_audio_done" });
  }, [processingSpeech]);

  const {
    start: startCapture,
    stop: stopCapture,
    mute,
    unmute,
    resetTurnSpeech,
    micLevel,
    isSpeaking,
    hasSpoken,
  } = useAudioCapture({
    onFrame: send,
    onSpeechEnd: finishSpokenTurn,
  });

  muteRef.current = mute;
  unmuteRef.current = unmute;
  resetTurnSpeechRef.current = resetTurnSpeech;

  const submitCandidateResponse = useCallback(() => {
    const text = manualInput.trim();
    if (!text) return;
    setProcessingSpeech(true);
    muteRef.current?.();
    resetTurnSpeech();
    sendJson({ type: "candidate_speech", text });
    setManualInput("");
  }, [manualInput, resetTurnSpeech, sendJson]);

  const toggleMic = useCallback(() => {
    if (micMutedRef.current) {
      micMutedRef.current = false;
      setMicMuted(false);
      if (!ttsSpeakingRef.current && !processingSpeech) {
        unmute();
      }
    } else {
      micMutedRef.current = true;
      setMicMuted(true);
      mute();
    }
  }, [mute, unmute, processingSpeech]);

  const startInterview = useCallback(async () => {
    if (!sessionId) return;
    setErrorMessage(null);
    setInterviewState("connecting");
    connect();
    await startCapture();
    muteRef.current?.();
  }, [sessionId, connect, startCapture]);

  const endInterview = useCallback(async () => {
    setInterviewState("ending");
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    stopBrowserTts();
    stopCapture();
    stopPlayback();
    sendJson({ type: "end_session" });
    disconnect();
    setInterviewState("complete");
  }, [stopBrowserTts, stopCapture, stopPlayback, sendJson, disconnect]);

  useEffect(() => {
    return () => {
      stopBrowserTts();
    };
  }, [stopBrowserTts]);

  const wsConnectionStatus = errorMessage
    ? "lost"
    : interviewState === "reconnecting"
    ? connectionLostLong
      ? "lost"
      : "reconnecting"
    : connectionState === "connected"
    ? "connected"
    : "reconnecting";

  // ── State A: Pre-start ──────────────────────────────────────────────────
  if (interviewState === "idle") {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">{candidateInfo?.role_title ?? "AI Interview"}</h1>
          {candidateInfo && (
            <p className="text-sm text-muted-foreground">{candidateInfo.time_limit_min} minutes</p>
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
              Start Interview
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── State F: Complete or Unrecoverable Error ────────────────────────────
  if (interviewState === "complete") {
    if (errorMessage) {
      return (
        <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-semibold">Connection Interrupted</h2>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <div className="pt-4 flex items-center justify-center gap-3">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry Session
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="text-4xl">✅</div>
        <h2 className="text-xl font-semibold">Interview Complete</h2>
        <p className="text-sm text-muted-foreground">
          Thank you. The interview has been recorded.
          <br />
          The hiring team will review your results and follow up with you.
        </p>
      </div>
    );
  }

  // ── States B/C/D/E: Active interview ────────────────────────────────────
  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";

  const candidateMicLabel = micMuted
    ? "Microphone muted"
    : processingSpeech
    ? "Transcribing & analyzing your answer..."
    : isSpeaking
    ? "Hearing your voice — keep speaking..."
    : hasSpoken
    ? "Voice captured — pause briefly to send, or click Done Speaking"
    : "Your turn — speak into your microphone";

  return (
    <div className="max-w-xl mx-auto px-4 flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between py-3 border-b sticky top-12 bg-background z-10">
        <span className="text-sm font-medium">{candidateInfo?.role_title ?? "AI Interview"}</span>
        {candidateInfo && (
          <InterviewTimer
            totalSeconds={candidateInfo.time_limit_min * 60}
            running={interviewState === "active"}
            onExpired={endInterview}
          />
        )}
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div className="flex items-center gap-2 text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-2.5 mt-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Reconnecting banner */}
      {interviewState === "reconnecting" && !errorMessage && (
        connectionLostLong ? (
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
        )
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

      {/* Voice indicator & Transcript */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 py-6">
        {interviewState === "connecting" ? (
          <div className="text-sm text-muted-foreground animate-pulse">
            Connecting to AI Interviewer...
          </div>
        ) : interviewState === "draining_audio" ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <VoiceBars active={true} label="AI speaking" variant="ai" />
            <p className="text-xs text-muted-foreground">Wrapping up...</p>
          </div>
        ) : (
          <>
            <VoiceBars
              active={aiSpeaking}
              label={
                interviewState === "reconnecting"
                  ? "Reconnecting..."
                  : aiSpeaking
                  ? "AI Interviewer speaking"
                  : "AI listening"
              }
              variant="ai"
            />

            {candidateSpeaking && (
              <div className="flex flex-col items-center gap-2.5 rounded-xl border bg-muted/30 px-6 py-3.5 w-full max-w-md">
                <VoiceBars
                  active={!micMuted && !processingSpeech}
                  level={micMuted || processingSpeech ? 0 : Math.max(micLevel, hasSpoken ? 15 : 8)}
                  label={candidateMicLabel}
                  variant="candidate"
                />

                {processingSpeech && (
                  <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing your spoken response...</span>
                  </div>
                )}

                {hasSpoken && !processingSpeech && !micMuted && (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
                    onClick={finishSpokenTurn}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                    Done Speaking — Send Answer
                  </Button>
                )}
              </div>
            )}

            {/* Transcript */}
            {transcript.length > 0 && (
              <div className="w-full space-y-2 overflow-y-auto max-h-[45vh] pr-1">
                {transcript.map((turn, i) => (
                  <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
                ))}
              </div>
            )}

            {/* Interactive spoken/typed response helper */}
            {interviewState === "active" && (
              <form
                className="w-full flex items-center gap-2 pt-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitCandidateResponse();
                }}
              >
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  disabled={aiSpeaking || processingSpeech}
                  placeholder={
                    aiSpeaking
                      ? "AI is speaking — please listen..."
                      : processingSpeech
                      ? "Processing your answer..."
                      : "Speak into your mic (auto-detected) or type your answer here..."
                  }
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  disabled={aiSpeaking || processingSpeech || !manualInput.trim()}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Send
                </Button>
              </form>
            )}
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t py-3 flex items-center justify-between gap-4 sticky bottom-0 bg-background">
        <ConnectionStatus state={wsConnectionStatus} />

        <div className="flex items-center gap-3">
          <Button
            variant={micMuted ? "destructive" : "outline"}
            size="sm"
            onClick={toggleMic}
          >
            {micMuted ? (
              <>
                <MicOff className="h-3.5 w-3.5 mr-1.5" /> Muted
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5 mr-1.5" /> Mic On
              </>
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
                <AlertDialogTitle>End interview?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to end the interview early? Your responses so far will be
                  saved and evaluated.
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
              className="text-xs opacity-50"
              onClick={() => sendJson({ type: "debug_force_reconnect" })}
            >
              ⚡ Force reconnect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
