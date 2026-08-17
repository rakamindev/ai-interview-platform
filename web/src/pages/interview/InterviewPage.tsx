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

  const [appealState, setAppealState] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const [appealError, setAppealError] = useState<string | null>(null);
  const [objectionNotes, setObjectionNotes] = useState("");

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

  const handleSubmitAppeal = useCallback(async () => {
    if (!token || objectionNotes.trim().length < 10) return;
    setAppealState('submitting');
    setAppealError(null);
    try {
      await sessionsApi.submitAppeal(token, objectionNotes.trim());
      setAppealState('submitted');
      setCandidateInfo(prev => prev ? {
        ...prev,
        audit_status: 'objection_filed',
        candidate_objection_notes: objectionNotes.trim()
      } : null);
    } catch (e: any) {
      console.error(e);
      setAppealState('error');
      setAppealError(e.response?.data?.error || "Failed to submit appeal. Please try again.");
    }
  }, [token, objectionNotes]);

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
    if (token) {
      try {
        await sessionsApi.audioComplete(token);
      } catch (e) {
        console.error("Failed to send audioComplete status", e);
      }
    }
    
    disconnect();
    setInterviewState("complete");
  }, [token, stopCapture, stopPlayback, sendJson, disconnect]);

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
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1.5 text-muted-foreground">
              <p>• This is a voice interview. Make sure you're in a quiet place.</p>
              <p>• The AI will ask follow-up questions — there are no scripts.</p>
              <p>• The session will last up to {candidateInfo?.time_limit_min ?? "—"} minutes.</p>
              <p>• Your mic will be active throughout. You can end anytime.</p>
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
    const isErrorSession = candidateInfo?.end_reason === "error";
    const hasFiledObjection = candidateInfo?.audit_status === "objection_filed" || appealState === "submitted";
    const isResolved = candidateInfo?.audit_status === "resolved" || candidateInfo?.audit_status === "retake_approved";
    const displayedNotes = candidateInfo?.candidate_objection_notes || objectionNotes;

    return (
      <div className="max-w-xl mx-auto px-4 py-16 space-y-8">
        <div className="text-center space-y-4">
          <div className="text-4xl">{isErrorSession ? "⚠️" : "✅"}</div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {isErrorSession ? "Interview Disrupted" : "Interview Complete"}
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
            {isErrorSession ? (
              "We encountered an unexpected technical or network disruption during your session. Rest assured, your completed responses have been securely saved."
            ) : (
              <>
                Thank you. The interview has been recorded.
                <br />
                The hiring team will review your results and follow up with you.
              </>
            )}
          </p>
        </div>

        {isErrorSession && (
          <div className="bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-xl p-6 shadow-sm space-y-6">
            {/* Warning Banner */}
            <div className="bg-amber-50/70 border border-amber-200/50 rounded-lg p-4 text-xs text-amber-900 space-y-1.5 leading-relaxed">
              <p className="font-semibold text-amber-950 flex items-center gap-1.5">
                <span>⚠️</span> Technical Anomaly Detected
              </p>
              <p>
                A connectivity or system error ended this session early. You are entitled to lodge a technical appeal to request a session reset or score adjustment.
              </p>
            </div>

            {isResolved ? (
              <div className="space-y-4">
                <div className="bg-blue-50/70 border border-blue-200/50 rounded-lg p-4 text-xs text-blue-900 space-y-2">
                  <p className="font-semibold text-blue-950 flex items-center gap-1.5">
                    <span>✅</span> Technical Objection Resolved
                  </p>
                  <p className="leading-relaxed">
                    The hiring team has reviewed your session and made a final decision regarding your technical appeal.
                  </p>
                  {candidateInfo?.audit_status === "retake_approved" && (
                    <p className="font-medium mt-1">Status: Retake Approved. Please check your email for a new invitation link.</p>
                  )}
                  {candidateInfo?.audit_status === "resolved" && (
                    <p className="font-medium mt-1">Status: Manually Scored based on partial answers.</p>
                  )}
                </div>
              </div>
            ) : hasFiledObjection ? (
              <div className="space-y-4">
                <div className="bg-emerald-50/70 border border-emerald-200/50 rounded-lg p-4 text-xs text-emerald-900 space-y-2">
                  <p className="font-semibold text-emerald-950 flex items-center gap-1.5">
                    <span>✅</span> Technical Objection Filed
                  </p>
                  <p className="italic bg-white/50 border border-emerald-100 p-2.5 rounded font-mono text-slate-700 text-[11px] leading-relaxed break-words">
                    "{displayedNotes}"
                  </p>
                </div>

                {/* SLA badging */}
                <div className="flex items-center justify-between p-3.5 bg-rose-50/60 border border-rose-100 rounded-lg text-xs animate-pulse">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-rose-950">Active SLA Urgency</span>
                    <p className="text-[10px] text-rose-800">Under review by organization security staff</p>
                  </div>
                  <span className="px-2.5 py-1 bg-rose-600 text-white font-semibold rounded-full text-[9px] uppercase tracking-wider">
                    Urgent (&lt;12 Hours)
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="objection-input" className="block text-xs font-semibold text-slate-700">
                    Explain the technical issue you faced:
                  </label>
                  <textarea
                    id="objection-input"
                    className="w-full min-h-[100px] text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50/30 font-sans"
                    placeholder="e.g. My network connection dropped for 2 minutes and I couldn't finish the last question..."
                    value={objectionNotes}
                    onChange={(e) => setObjectionNotes(e.target.value)}
                    disabled={appealState === "submitting"}
                  />
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={objectionNotes.trim().length >= 10 ? "text-emerald-600 font-medium" : "text-slate-400"}>
                      {objectionNotes.trim().length} / 10 characters minimum
                    </span>
                  </div>
                </div>

                {appealState === "error" && appealError && (
                  <p className="text-xs text-rose-600 font-medium bg-rose-50 border border-rose-100 rounded-md p-2">
                    {appealError}
                  </p>
                )}

                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors text-xs py-2.5 h-auto"
                  onClick={handleSubmitAppeal}
                  disabled={objectionNotes.trim().length < 10 || appealState === "submitting"}
                >
                  {appealState === "submitting" ? "Submitting Appeal..." : "Submit Technical Appeal"}
                </Button>
              </div>
            )}
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
