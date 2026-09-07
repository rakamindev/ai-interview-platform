import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ConsentModal } from "@/components/interview/ConsentModal";
import { CheckCircle, Mic, MicOff, Volume2 } from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [hasGivenConsent, setHasGivenConsent] = useState(false);
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false); // kept for green banner
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string | undefined>();

  // Fetch candidate info
  useEffect(() => {
    if (!token) return;
    sessionsApi.getCandidateInfo(token)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        if (res.data.has_consented) {
          setHasGivenConsent(true);
        }
        if (res.data.session_status === "ended") setInterviewState("complete");
      })
      .catch(() => setInterviewState("complete"));
  }, [token]);

  // Enumerate audio input devices
  const loadAudioDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === "audioinput");
      setAudioDevices(inputs);
      return inputs;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    loadAudioDevices();
  }, [loadAudioDevices]);

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  const handleStateChange = useCallback((state: InterviewState) => {
    setInterviewState(state);

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
  }, []);

  const handleReconnected = useCallback(() => {
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    setReconnectedPrompt(true);
    reconnectedPromptTimerRef.current = setTimeout(() => setReconnectedPrompt(false), 10_000);
  }, []);

  const handleTranscript = useCallback((turn: Pick<TranscriptTurn, "speaker" | "text">) => {
    setTranscript((prev) => [...prev.slice(-9), turn]); // keep last 10
  }, []);

  const {
    playChunk,
    stop: stopPlayback,
    scheduleAfterPlayback,
    waitForDrain,
    cancelDrain,
    resumeAudioContext,
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
    const attempt = async (delay: number) => {
      try {
        await sessionsApi.audioComplete(token);
      } catch {
        setTimeout(() => attempt(Math.min(delay * 2, 8000)), delay);
      }
    };
    attempt(2000);
  }, [token, cancelDrain]);

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

  const { connect, send, sendJson, disconnect, connectionState } = useAudioWebSocket({
    sessionId: sessionId ?? 0,
    token,
    onAudioChunk: playChunk,
    onTranscript: handleTranscript,
    onStateChange: handleStateChange,
    onSpeakerChange: handleSpeakerChange,
    onReconnected: handleReconnected,
  });

  const {
    start: startCapture,
    stop: stopCapture,
    mute,
    unmute,
    switchDevice,
    audioLevel,
  } = useAudioCapture({
    onFrame: send,
  });

  muteRef.current = mute;
  unmuteRef.current = unmute;

  const handleDeviceChange = useCallback(async (newDeviceId: string) => {
    setSelectedMicId(newDeviceId);
    await switchDevice(newDeviceId);
  }, [switchDevice]);

  // Listen for device changes (e.g. candidate disconnects Bluetooth headset during interview)
  useEffect(() => {
    const handleDeviceListChange = async () => {
      const inputs = await loadAudioDevices();
      if (inputs.length > 0 && selectedMicId) {
        const stillExists = inputs.some((d) => d.deviceId === selectedMicId);
        if (!stillExists) {
          // Device lost: seamlessly fall back to first available audio input
          const fallbackMic = inputs[0].deviceId;
          setSelectedMicId(fallbackMic);
          if (interviewState === "active" || interviewState === "connecting") {
            await switchDevice(fallbackMic);
          }
        }
      }
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceListChange);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceListChange);
    };
  }, [loadAudioDevices, selectedMicId, interviewState, switchDevice]);

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

  const handleConsent = useCallback(async () => {
    try {
      await resumeAudioContext();
    } catch (e) {
      console.warn("[InterviewPage] Failed to resume AudioContext during consent gesture:", e);
    }
    if (token) {
      try {
        await sessionsApi.recordConsent(token, "v1.0");
      } catch (e) {
        console.warn("[InterviewPage] Failed to record consent on backend:", e);
      }
    }
    setHasGivenConsent(true);
  }, [resumeAudioContext, token]);

  const startInterview = useCallback(async (micId?: string) => {
    if (!sessionId) return;
    try {
      await resumeAudioContext();
    } catch (e) {
      console.warn("[InterviewPage] Failed to resume AudioContext during startInterview:", e);
    }
    const targetMicId = micId || selectedMicId;
    if (targetMicId) setSelectedMicId(targetMicId);
    setInterviewState("connecting");
    connect();
    await startCapture(targetMicId);
    // Start muted — only unmute when backend sends speaker_changed: candidate.
    // This prevents mic audio from being sent during AI speech, since separate
    // AudioContexts for capture/playback break the browser's echo cancellation.
    muteRef.current?.();
  }, [sessionId, connect, startCapture, selectedMicId, resumeAudioContext]);

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
      ? connectionLostLong ? "lost" : "reconnecting"
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
            <p className="text-sm text-muted-foreground">
              {candidateInfo.time_limit_min} minutes
            </p>
          )}
        </div>

        {/* Explicit Privacy & Data Processing Consent Modal */}
        {!hasGivenConsent && (
          <ConsentModal
            roleTitle={candidateInfo?.role_title}
            onConsent={handleConsent}
          />
        )}

        {hasGivenConsent && (
          !hardwareCheckDone ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1.5 text-muted-foreground">
                <p>• This is a voice interview. Make sure you're in a quiet place.</p>
                <p>• The AI will ask follow-up questions — there are no scripts.</p>
                <p>• The session will last up to {candidateInfo?.time_limit_min ?? "—"} minutes.</p>
                <p>• Your mic will be active throughout. You can end anytime.</p>
              </div>
              <HardwareCheck
                onStart={(micId) => {
                  setSelectedMicId(micId);
                  setHardwareCheckDone(true);
                  startInterview(micId);
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>Hardware checks passed. You're ready to start.</span>
              </div>
              <Button className="w-full" size="lg" onClick={() => startInterview(selectedMicId)}>
                <Mic className="h-4 w-4 mr-2" />
                Start Interview
              </Button>
            </div>
          )
        )}
      </div>
    );
  }

  // ── State F: Complete ───────────────────────────────────────────────────
  if (interviewState === "complete") {
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

  return (
    <div className="max-w-xl mx-auto px-4 flex flex-col h-full space-y-3">
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

      {/* Mic toolbar: selector and real-time audio level */}
      {interviewState === "active" && (
        <div className="bg-muted/40 border rounded-lg p-2.5 flex items-center justify-between gap-3 text-xs">
          {/* Device selector */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Mic className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {audioDevices.length > 0 ? (
              <Select
                value={selectedMicId || audioDevices[0]?.deviceId}
                onValueChange={handleDeviceChange}
              >
                <SelectTrigger className="h-7 text-xs bg-background/80 flex-1 truncate">
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
            ) : (
              <span className="text-muted-foreground truncate">Default Microphone</span>
            )}
          </div>

          {/* Volume meter */}
          <div className="flex items-center gap-2 shrink-0">
            <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="w-20 bg-muted rounded-full h-1.5 overflow-hidden border">
              <div
                className={`h-full transition-all duration-100 ${
                  micMuted
                    ? "bg-muted-foreground/30"
                    : audioLevel > 5
                      ? "bg-green-500"
                      : "bg-muted-foreground/20"
                }`}
                style={{ width: `${micMuted ? 0 : Math.min(audioLevel, 100)}%` }}
              />
            </div>
            <span className="text-muted-foreground font-mono w-7 text-right">
              {micMuted ? "off" : `${audioLevel}%`}
            </span>
          </div>
        </div>
      )}

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

      {/* Voice indicator and Controls */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-6">
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
              <div className="w-full space-y-2 overflow-y-auto max-h-[50vh] mt-4">
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

        <div className="flex items-center gap-2">
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
