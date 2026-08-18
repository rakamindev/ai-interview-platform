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
import { CheckCircle, Mic, MicOff } from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

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

  const { playChunk, stop: stopPlayback, scheduleAfterPlayback, waitForDrain, cancelDrain } = useAudioPlayback();
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

        {!hardwareCheckDone ? (
          <div className="space-y-4">
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 text-xs text-slate-200 space-y-2 shadow-xl backdrop-blur-md">
              <p className="flex items-center gap-2 text-teal-300 font-semibold mb-1">
                <span>🎙️</span> Voice Assessment Instructions:
              </p>
              <p className="text-slate-300">• This is an interactive voice interview. Please ensure you are in a quiet environment.</p>
              <p className="text-slate-300">• The AI will ask relevant follow-up questions — there are no fixed rigid scripts.</p>
              <p className="text-slate-300">• The session will last up to <strong className="text-teal-300">{candidateInfo?.time_limit_min ?? "—"} minutes</strong>.</p>
              <p className="text-slate-300">• Your microphone will remain active throughout. You can complete or end anytime.</p>
            </div>
            <HardwareCheck onStart={() => { setHardwareCheckDone(true); startInterview(); }} />
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

  // ── State F: Complete ───────────────────────────────────────────────────
  if (interviewState === "complete") {
    const isError = candidateInfo?.end_reason === "error";

    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        {isError ? (
          <div className="space-y-4">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-xl font-bold text-rose-400">Session Error Encountered</h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
              This interview session was interrupted by a network connection timeout before audio transcript turns could be recorded.
              <br />
              Please contact your hiring manager or request a new interview link.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-4xl">✅</div>
            <h2 className="text-xl font-bold text-emerald-400">Interview Complete</h2>
            <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
              Thank you. Your interview session has been recorded and submitted successfully.
              <br />
              The hiring team will review your evaluation results and follow up with you shortly.
            </p>
          </div>
        )}
      </div>
    );
  }


  // ── States B/C/D/E: Active interview ────────────────────────────────────
  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";

  return (
    <div className="max-w-xl mx-auto px-4 flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between py-3 border-b border-slate-800 sticky top-14 bg-slate-950/90 backdrop-blur-md z-10">
        <span className="text-sm font-semibold text-slate-200">AI Voice Assessment</span>
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
          <div className="flex items-center gap-2 text-xs bg-rose-950/90 border border-rose-500/40 text-rose-200 rounded-xl px-4 py-3 mt-3 shadow-xl">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>Connection is taking too long to restore. Please wait, or contact the interviewer if this persists.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs bg-amber-950/90 border border-amber-500/40 text-amber-200 rounded-xl px-4 py-3 mt-3 shadow-xl">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Briefly reconnecting audio stream — please wait a moment.</span>
          </div>
        )
      )}

      {/* Reconnected prompt */}
      {reconnectedPrompt && (
        <div className="flex items-center justify-between text-xs bg-teal-950/90 border border-teal-500/40 text-teal-200 rounded-xl px-4 py-3 mt-3 shadow-xl">
          <span>Reconnected — please say <strong>"check"</strong> or continue your answer to resume.</span>
          <button className="ml-3 text-teal-400 hover:text-teal-200 shrink-0" onClick={() => setReconnectedPrompt(false)}>✕</button>
        </div>
      )}

      {/* Voice indicator */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
        {interviewState === "connecting" ? (
          <div className="text-sm font-medium text-teal-400 animate-pulse">Establishing Secure Audio Connection...</div>
        ) : interviewState === "draining_audio" ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <VoiceBars active={true} label="AI speaking" variant="ai" />
            <p className="text-xs text-slate-400">Wrapping up session...</p>
          </div>
        ) : (
          <>
            <VoiceBars
              active={aiSpeaking}
              label={aiSpeaking ? "AI Speaking" : "Listening..."}
              variant="ai"
            />

            {candidateSpeaking && (
              <VoiceBars
                active={true}
                label="You're Speaking"
                variant="candidate"
              />
            )}

            {/* Transcript */}
            {transcript.length > 0 && (
              <div className="w-full space-y-2 overflow-y-auto max-h-[60vh] pr-1">
                {transcript.map((turn, i) => (
                  <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-slate-800 py-3.5 flex items-center justify-between gap-4 sticky bottom-0 bg-slate-950/90 backdrop-blur-md">
        <ConnectionStatus state={wsConnectionStatus} />

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            onClick={toggleMic}
            className={
              micMuted
                ? "bg-rose-950/80 text-rose-300 border border-rose-500/50 hover:bg-rose-900/80 font-semibold shadow-sm"
                : "bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900/80 font-semibold shadow-sm"
            }
          >
            {micMuted ? (
              <><MicOff className="h-3.5 w-3.5 mr-1.5 text-rose-400" /> Muted</>
            ) : (
              <><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1.5" /> Mic On</>
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" className="bg-slate-900 border border-slate-700 text-slate-100 font-semibold hover:bg-rose-950/80 hover:text-rose-300 hover:border-rose-500/50 shadow-sm">
                End Interview
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-slate-900 border border-slate-800 text-slate-100">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">End interview early?</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-300">
                  Are you sure you want to complete and submit your interview session now?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 font-semibold">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={endInterview} className="bg-rose-600 hover:bg-rose-500 text-white font-semibold">End interview</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {import.meta.env.DEV && (
            <Button size="sm" className="text-xs bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-slate-100 opacity-75 font-semibold"
              onClick={() => sendJson({ type: "debug_force_reconnect" })}>
              ⚡ Force reconnect
            </Button>
          )}
        </div>

      </div>


    </div>
  );
}
