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
import InterviewTimer from "@/components/interview/InterviewTimer";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { sessionsApi } from "@/services/sessions";
import HardwareCheck from "@/components/HardwareCheck";
import InterviewCompleteView from "@/components/interview/InterviewCompleteView";
import { CheckCircle, Mic, MicOff, AlertCircle } from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false); // kept for green banner

  // Auto-scroll transcript
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

  // Ensure we have the latest candidate info when the interview completes
  useEffect(() => {
    if (interviewState === "complete" && token) {
      let isSubscribed = true;
      
      const fetchFinalState = async (attempts = 0) => {
        try {
          const res = await sessionsApi.getCandidateInfo(token);
          if (!isSubscribed) return;
          
          // If backend hasn't finalized the session yet
          if (res.data.session_status !== "ended") {
            if (attempts < 5) {
              // Retry up to 5 times (1.5s intervals)
              setTimeout(() => fetchFinalState(attempts + 1), 1500);
            } else {
              // RESILIENCY SEAM: Backend failed to update status in time.
              setCandidateInfo((prev) => prev ? { ...prev, session_status: "ended", end_reason: "error" } : res.data);
            }
          } else {
            // Backend successfully marked it as ended
            setCandidateInfo(res.data);
          }
        } catch (e) {
          console.error("fetchFinalState error:", e);
          if (!isSubscribed) return;
          
          // If API fails (e.g. 404, 500), we still need to retry or fallback
          if (attempts < 5) {
            setTimeout(() => fetchFinalState(attempts + 1), 1500);
          } else {
            // Give up and force error state locally
            setCandidateInfo((prev) => prev ? { ...prev, session_status: "ended", end_reason: "error" } : null);
          }
        }
      };

      // Add a small 1s delay before first fetch to allow backend to process WS disconnect
      const timer = setTimeout(() => fetchFinalState(), 1000);
      
      return () => {
        isSubscribed = false;
        clearTimeout(timer);
      };
    }
  }, [interviewState, token]);

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
    return (
      <InterviewCompleteView
        token={token}
        candidateInfo={candidateInfo}
        setCandidateInfo={setCandidateInfo}
      />
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
