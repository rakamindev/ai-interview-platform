import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
} from "@/components/ui/alert-dialog";
import InterviewTimer from "@/components/interview/InterviewTimer";
import ConnectionStatus from "@/components/interview/ConnectionStatus";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { sessionsApi } from "@/services/sessions";
import HardwareCheck from "@/components/HardwareCheck";
import {
  CheckCircle,
  Mic,
  MicOff,
  PhoneOff,
  Home,
  XCircle,
  Sparkles,
  Volume2,
} from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

// ── Google Meet-style participant card tile (Note #13) ──────────────────
function MeetParticipantTile({
  name,
  initials,
  isSpeaking,
  isMuted,
  isAI,
}: {
  name: string;
  initials: string;
  isSpeaking: boolean;
  isMuted?: boolean;
  isAI?: boolean;
}) {
  return (
    <div
      className={`relative flex-1 min-h-[220px] sm:min-h-[260px] rounded-2xl bg-slate-900 border transition-all duration-300 flex flex-col items-center justify-center p-6 overflow-hidden ${
        isSpeaking
          ? isAI
            ? "border-[#01959F] shadow-[0_0_20px_rgba(1,149,159,0.25)] ring-2 ring-[#01959F]/60"
            : "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-2 ring-emerald-500/60"
          : "border-slate-800"
      }`}
    >
      {/* Background subtle glow when speaking */}
      {isSpeaking && (
        <div
          className={`absolute inset-0 opacity-10 transition-opacity duration-300 ${
            isAI ? "bg-[#01959F]" : "bg-emerald-500"
          }`}
        />
      )}

      {/* Center Avatar with Google Meet animated soundwave pulse */}
      <div className="relative flex items-center justify-center mb-3">
        {isSpeaking && (
          <>
            <span
              className={`absolute w-24 h-24 rounded-full animate-ping opacity-25 ${
                isAI ? "bg-[#01959F]" : "bg-emerald-500"
              }`}
            />
            <span
              className={`absolute w-28 h-28 rounded-full animate-pulse opacity-15 ${
                isAI ? "bg-[#01959F]" : "bg-emerald-500"
              }`}
            />
          </>
        )}

        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-md transition-transform duration-300 ${
            isSpeaking ? "scale-105" : "scale-100"
          } ${
            isAI
              ? "bg-gradient-to-tr from-[#017a82] to-[#01959F]"
              : "bg-gradient-to-tr from-slate-700 to-slate-600"
          }`}
        >
          {isAI ? (
            <Sparkles className="h-9 w-9 text-amber-300" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
      </div>

      {/* Participant Name badge bottom-left */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-slate-950/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/60">
        <span className="text-xs font-medium text-white truncate max-w-[140px] sm:max-w-[200px]">
          {name}
        </span>
        {isAI && (
          <span className="text-[10px] bg-[#01959F] text-white px-1.5 py-0.2 rounded font-semibold">
            AI
          </span>
        )}
      </div>

      {/* Mic status badge bottom-right (Google Meet style) */}
      <div className="absolute bottom-3 right-3">
        {isMuted ? (
          <div
            className="w-7 h-7 rounded-full bg-rose-600 flex items-center justify-center text-white shadow-sm"
            title="Microphone is muted"
          >
            <MicOff className="h-3.5 w-3.5" />
          </div>
        ) : isSpeaking ? (
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-white shadow-sm animate-pulse ${
              isAI ? "bg-[#01959F]" : "bg-emerald-600"
            }`}
            title="Speaking"
          >
            <Volume2 className="h-3.5 w-3.5" />
          </div>
        ) : (
          <div
            className="w-7 h-7 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300"
            title="Microphone is active (Listening)"
          >
            <Mic className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false);
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);

  // Note #15: Controlled dialog state with event blocking to prevent auto-close
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [closeAttempted, setCloseAttempted] = useState(false);

  // Fetch candidate info
  useEffect(() => {
    if (!token) return;
    sessionsApi.getCandidateInfo(token)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        if (res.data.session_status === "ended") setInterviewState("complete");
      })
      .catch(() => {
        // Note #14: Do NOT auto complete on initial fetch error
      });
  }, [token]);

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  const handleStateChange = useCallback((state: InterviewState) => {
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
      connectionLostTimerRef.current = setTimeout(() => {
        setConnectionLostLong(true);
      }, 30_000);
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
    reconnectedPromptTimerRef.current = setTimeout(() => setReconnectedPrompt(false), 8_000);
  }, []);

  const handleTranscript = useCallback((turn: Pick<TranscriptTurn, "speaker" | "text">) => {
    setTranscript((prev) => [...prev.slice(-9), turn]);
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
    muteRef.current?.();
  }, [sessionId, connect, startCapture]);

  const endInterview = useCallback(async () => {
    setShowEndDialog(false);
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

  // ── State A: Modern Interview Lobby (Note #40) ───────────────────────────
  if (interviewState === "idle") {
    return (
      <div className="min-h-screen bg-slate-50/70 py-10 px-4 flex items-center justify-center">
        <div className="max-w-xl w-full">
          <HardwareCheck
            roleTitle={candidateInfo?.role_title}
            candidateName={candidateInfo?.candidate_name}
            timeLimitMin={candidateInfo?.time_limit_min}
            onStart={() => {
              setHardwareCheckDone(true);
              startInterview();
            }}
          />
        </div>
      </div>
    );
  }

  // ── State F: Complete (Note #16: tombol kembali ke home & selesai sesi) ───
  if (interviewState === "complete") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white border border-slate-200/90 rounded-2xl p-8 text-center space-y-6 shadow-sm">
          {/* Success Icon */}
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">Interview Complete</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Thank you, <strong>{candidateInfo?.candidate_name || "Candidate"}</strong>.<br />
              Your interview recording and transcripts have been successfully submitted to the Rakamin recruiting team.
            </p>
          </div>

          {/* Action buttons (Note #1 & Discussion #8) */}
          <div className="flex flex-col gap-2.5 pt-2">
            <Button
              size="lg"
              className="w-full bg-[#01959F] hover:bg-[#017a82] text-white font-medium"
              onClick={() => {
                window.location.href = "https://app.rakamin.com/career-solutions/dashboard";
              }}
            >
              <Home className="h-4 w-4 mr-2" />
              Return to Rakamin Portal
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Competency evaluation results will be reviewed by the recruiting team. Best of luck!
          </p>
        </div>
      </div>
    );
  }

  // ── Active Interview Session (Note #13: Google Meet Layout) ─────────────
  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";
  const candidateInitials = candidateInfo?.candidate_name
    ? candidateInfo.candidate_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "ME";

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between select-none">
      {/* Top Bar: Title & Timer */}
      <header className="h-14 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <img src="/rakamin-icon.png" alt="Rakamin" className="h-6 w-auto" />
          <span className="text-sm font-semibold tracking-tight text-slate-200">
            {candidateInfo?.role_title || "Rakamin AI Interview"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {candidateInfo && (
            <InterviewTimer
              totalSeconds={candidateInfo.time_limit_min * 60}
              running={interviewState === "active"}
              onExpired={endInterview}
            />
          )}
          <ConnectionStatus state={wsConnectionStatus} />
        </div>
      </header>

      {/* Reconnecting notifications */}
      {interviewState === "reconnecting" && (
        <div className="mx-auto mt-3 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Connection temporarily lost — reconnecting...</span>
        </div>
      )}

      {reconnectedPrompt && (
        <div className="mx-auto mt-3 px-4 py-2 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs flex items-center gap-2">
          <span>Reconnected. Please continue your response.</span>
          <button className="text-blue-400 hover:text-white" onClick={() => setReconnectedPrompt(false)}>✕</button>
        </div>
      )}

      {/* Main Center Area: Google Meet Video/Avatar Tiles (Note #13) */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 items-stretch max-h-[520px]">
          {/* AI Interviewer Tile */}
          <MeetParticipantTile
            name="Rakamin AI Interviewer"
            initials="AI"
            isSpeaking={aiSpeaking}
            isAI={true}
          />

          {/* Candidate Tile */}
          <MeetParticipantTile
            name={candidateInfo?.candidate_name || "You"}
            initials={candidateInitials}
            isSpeaking={candidateSpeaking && !micMuted}
            isMuted={micMuted}
          />
        </div>

        {/* Live Transcript Subtitles (Google Meet style caption bar) */}
        {transcript.length > 0 && (
          <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 max-h-36 overflow-y-auto space-y-1.5 backdrop-blur-md">
            {transcript.map((turn, i) => (
              <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
            ))}
          </div>
        )}
      </main>

      {/* Bottom Control Bar: Google Meet floating circular control buttons */}
      <footer className="h-20 border-t border-slate-800 bg-slate-950/90 px-6 flex items-center justify-center gap-4">
        {/* Mic Toggle Button */}
        <button
          type="button"
          onClick={toggleMic}
          className={`h-12 w-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-md ${
            micMuted
              ? "bg-rose-600 hover:bg-rose-700 text-white"
              : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
          }`}
          title={micMuted ? "Unmute Microphone" : "Mute Microphone"}
        >
          {micMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* End Interview Call Button */}
        <button
          type="button"
          onClick={() => setShowEndDialog(true)}
          className="h-12 w-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition-all duration-200 shadow-md"
          title="End Interview"
        >
          <PhoneOff className="h-5 w-5" />
        </button>

        {import.meta.env.DEV && (
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] text-slate-500 hover:text-slate-300"
            onClick={() => sendJson({ type: "debug_force_reconnect" })}
          >
            ⚡ Reconnect
          </Button>
        )}
      </footer>

      {/* Note #15: Controlled AlertDialog prevents unwanted closing during audio rendering */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent className="bg-white text-slate-900 sm:max-w-md border border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-slate-900">
              End Interview?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600">
              Are you sure you want to end this interview session early? All responses recorded so far will be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex gap-2">
            <AlertDialogCancel
              onClick={() => setShowEndDialog(false)}
              className="text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
              onClick={endInterview}
            >
              Yes, End Interview
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
