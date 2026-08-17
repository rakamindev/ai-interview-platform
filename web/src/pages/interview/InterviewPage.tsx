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
  
  const isPulsing = aiSpeaking || candidateSpeaking || interviewState === "connecting" || interviewState === "draining_audio";
  const orbCoreColor = aiSpeaking ? "bg-[#b1c782]" : candidateSpeaking ? "bg-[#c8d4ad]" : "bg-slate-200";
  const ringColor = aiSpeaking ? "border-[#d8e2c3]" : candidateSpeaking ? "border-[#e6ede2]" : "border-slate-100";

  return (
    <div className="fixed inset-0 w-full h-full bg-slate-50 flex flex-col items-center justify-between overflow-hidden z-50">
      
      {/* Screen Reader Only Transcript for Accessibility */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {transcript.map((turn, i) => (
          <p key={i}>{turn.speaker === "ai" ? "AI: " : "Candidate: "}{turn.text}</p>
        ))}
      </div>

      {/* Development Force Reconnect Tool */}
      {import.meta.env.DEV && (
        <div className="absolute top-4 left-4 z-50">
          <Button variant="outline" size="sm" className="text-xs opacity-50 bg-white" onClick={() => sendJson({ type: "debug_force_reconnect" })}>
            ⚡ Force reconnect
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="pt-16 pb-4 w-full flex flex-col items-center z-10 space-y-1.5 shrink-0">
        <h1 className="text-3xl font-bold text-[#4a5338] tracking-tight flex items-center justify-center gap-3">
          Rakamin AI
          {candidateInfo && (
            <span className="font-semibold tabular-nums text-3xl">
              <InterviewTimer
                totalSeconds={candidateInfo.time_limit_min * 60}
                running={interviewState === "active"}
                onExpired={endInterview}
              />
            </span>
          )}
        </h1>
        <p className="text-sm text-[#9ca68b] font-medium tracking-wide">
          by rakamin.com
        </p>

        {/* Network Banners */}
        <div className="absolute top-32 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 flex flex-col items-center gap-2">
          {interviewState === "reconnecting" && (
            connectionLostLong ? (
              <div className="flex items-center justify-center gap-2 text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded-full px-4 py-2 shadow-sm">
                <span className="animate-pulse">●</span>
                <span>Connection taking too long to restore.</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-4 py-2 shadow-sm">
                <span className="animate-pulse">●</span>
                <span>Briefly reconnecting...</span>
              </div>
            )
          )}
          {reconnectedPrompt && (
            <div className="flex items-center justify-center gap-2 text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded-full px-4 py-2 shadow-sm cursor-pointer hover:bg-blue-100" onClick={() => setReconnectedPrompt(false)}>
              <span>Reconnected — say "check" to resume.</span>
              <span className="ml-1 opacity-60">✕</span>
            </div>
          )}
          {interviewState === "draining_audio" && (
            <div className="flex items-center justify-center gap-2 text-xs bg-slate-100 border border-slate-200 text-slate-600 rounded-full px-4 py-2 shadow-sm">
              <span>Wrapping up...</span>
            </div>
          )}
        </div>
      </div>

      {/* The Orb Visualizer */}
      <div className="flex-1 flex items-center justify-center w-full relative z-0">
        <div className="relative flex items-center justify-center w-[300px] h-[300px]">
          {/* Outer Ring */}
          <div className={`absolute inset-0 rounded-full border-[2px] ${ringColor} ${isPulsing ? "animate-pulse" : "opacity-30"} transition-colors duration-1000`} style={{ transform: "scale(1.45)" }}></div>
          
          {/* Middle Ring */}
          <div className={`absolute inset-0 rounded-full border-[2px] ${ringColor} ${isPulsing ? "animate-pulse" : "opacity-50"} transition-colors duration-700`} style={{ transform: "scale(1.2)" }}></div>
          
          {/* Core Orb */}
          <div className={`relative w-48 h-48 rounded-full ${orbCoreColor} shadow-inner transition-all duration-500 ease-in-out ${isPulsing ? "scale-105" : "scale-100"}`}></div>
        </div>
      </div>

      {/* Floating Control Pill */}
      <div className="pb-10 w-full flex flex-col items-center z-10 space-y-5 shrink-0">
        <div className="flex items-center gap-2 bg-[#f4f7ee] p-2.5 rounded-3xl border border-[#e8efe0] shadow-sm">
          
          <Button
            variant="ghost"
            onClick={toggleMic}
            className="hover:bg-black/5 rounded-2xl h-14 px-7 transition-colors"
          >
            {micMuted ? (
              <MicOff className="h-5 w-5 text-[#4a5338]" />
            ) : (
              <Mic className="h-5 w-5 text-[#4a5338]" />
            )}
            <span className="font-semibold text-[#4a5338] ml-3 text-base">{micMuted ? "Muted" : "Mute"}</span>
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="hover:bg-black/5 rounded-2xl h-14 px-7 transition-colors">
                <div className="w-4 h-4 bg-[#e85b5b] rounded-sm mr-3"></div>
                <span className="font-semibold text-[#4a5338] text-base">End call</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl border-slate-200">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-slate-900">End interview?</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-500">
                  Are you sure you want to end the interview early?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-slate-200 rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={endInterview} className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl">
                  End interview
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
        </div>
        
        <p className="text-xs text-[#a4ad96] font-medium tracking-wide">
          Rakamin AI can make mistakes. Always double-check info.
        </p>
      </div>

    </div>
  );
}
