import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  CheckCircle,
  CheckCircle2,
  Mic,
  MicOff,
  AlertTriangle,
  Sparkles,
  Clock,
  Headphones,
  MessagesSquare,
  Timer,
  ShieldCheck,
} from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewErrorReason, InterviewSpeaker, TranscriptTurn } from "@/types";
import type { InterviewErrorDetail } from "@/hooks/useAudioWebSocket";

const ERROR_COPY: Record<InterviewErrorReason, { title: string; body: string }> = {
  fetch_failed: {
    title: "This interview link isn't working",
    body: "It may be invalid or expired. Nothing has been recorded. Please contact the recruiting team for a new link.",
  },
  connection_lost: {
    title: "Connection lost",
    body: "We couldn't restore the connection to your interview. Your progress up to this point may not be fully saved — please contact the interviewer before retrying.",
  },
  server_error: {
    title: "Something went wrong",
    body: "The interview couldn't continue due to a technical issue on our end. Nothing further will be recorded — please contact the interviewer.",
  },
};

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [errorReason, setErrorReason] = useState<InterviewErrorReason>("server_error");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false);
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
      .catch(() => {
        setErrorReason("fetch_failed");
        setInterviewState("error");
      });
  }, [token]);

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  const handleStateChange = useCallback((state: InterviewState, errorDetail?: InterviewErrorDetail) => {
    setInterviewState(state);

    if (state === "error" && errorDetail) {
      setErrorReason(errorDetail.reason);
      if (errorDetail.message) console.error("[interview error]", errorDetail.reason, errorDetail.message);
    }

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
      if (speaker === "candidate") unmute();
    } else {
      micMutedRef.current = true;
      setMicMuted(true);
      mute();
    }
  }, [speaker, mute, unmute]);

  const startInterview = useCallback(async () => {
    setInterviewState("connecting");
    try {
      await startCapture();
      connect();
    } catch {
      setErrorReason("server_error");
      setInterviewState("error");
    }
  }, [startCapture, connect]);

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

  // ── State A: Pre-start / Onboarding ─────────────────────────────────────
  if (interviewState === "idle") {
    return (
      <div className="min-h-screen bg-slate-50/70 py-10 px-4 sm:px-6 flex flex-col justify-center items-center">
        <div className="w-full max-w-2xl space-y-6">
          
          {/* Top Brand Tag */}
          <div className="flex items-center justify-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-bold text-slate-900 text-base">Rakamin</span>
              <span className="font-semibold text-primary text-base">AI Interview</span>
            </div>
          </div>

          {/* Hero Role Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-xs text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary flex items-center justify-center border border-primary/20 shadow-xs">
              <Mic className="h-7 w-7" />
            </div>
            
            <div className="space-y-1 max-w-md mx-auto">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                {candidateInfo?.role_title ?? "AI Voice Assessment"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Automated Technical &amp; Competency Evaluation
              </p>
            </div>

            {/* Metadata Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 px-3 py-1 font-medium text-xs flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span>{candidateInfo?.time_limit_min ?? 45} Minutes Max</span>
              </Badge>
              <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 px-3 py-1 font-medium text-xs flex items-center gap-1.5">
                <Mic className="h-3.5 w-3.5 text-slate-500" />
                <span>Voice Interactive</span>
              </Badge>
              <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 px-3 py-1 font-medium text-xs flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span>Auto-Transcribed</span>
              </Badge>
            </div>
          </div>

          {/* 3 Quick Guidelines / Tips Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-1.5 text-left">
              <div className="h-8 w-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                <Headphones className="h-4 w-4" />
              </div>
              <p className="text-xs font-bold text-slate-900">Quiet Environment</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Use earphones or headphones to minimize echo and capture your voice clearly.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-1.5 text-left">
              <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                <MessagesSquare className="h-4 w-4" />
              </div>
              <p className="text-xs font-bold text-slate-900">Natural Dialogue</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Speak naturally. The AI will ask relevant technical follow-up questions dynamically.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-1.5 text-left">
              <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
                <Timer className="h-4 w-4" />
              </div>
              <p className="text-xs font-bold text-slate-900">Comfortable Pace</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Take your time to think and explain. You can end the interview whenever finished.
              </p>
            </div>
          </div>

          {/* System Hardware Readiness Check Card */}
          <HardwareCheck
            onStart={() => {
              setHardwareCheckDone(true);
              startInterview();
            }}
          />
        </div>
      </div>
    );
  }

  // ── State: Error ────────────────────────────────────────────────────────
  if (interviewState === "error") {
    const copy = ERROR_COPY[errorReason];
    return (
      <div className="min-h-screen bg-slate-50/70 py-16 px-4 flex flex-col items-center justify-center">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-xs">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">{copy.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{copy.body}</p>
        </div>
      </div>
    );
  }

  // ── State F: Complete (Clean, Minimal & Professional) ───────────────────
  if (interviewState === "complete") {
    const candidateName = candidateInfo?.candidate_name;
    const roleTitle = candidateInfo?.role_title ?? "posisi ini";

    return (
      <div className="min-h-screen bg-slate-50/70 py-12 px-4 sm:px-6 flex flex-col justify-center items-center">
        <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs text-center space-y-5">
          
          {/* Celebratory Icon Avatar */}
          <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          {/* Title & Reassurance Subtitle */}
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Interview Complete
            </h2>
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Sesi Wawancara Berhasil Diselesaikan
            </p>
          </div>

          {/* Friendly Confirmation Message */}
          <div className="space-y-2 text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
            <p>
              Terima kasih{candidateName ? <span className="font-semibold text-slate-900">, {candidateName}</span> : ""}! Rekaman jawaban wawancara Anda untuk lowongan <span className="font-semibold text-slate-900">{roleTitle}</span> telah berhasil terkirim dan tersimpan di sistem.
            </p>
          </div>

          {/* Next Steps Info Box */}
          <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 text-xs space-y-2 text-left">
            <p className="text-slate-600 leading-relaxed">
              Informasi kelulusan dan tahap seleksi selanjutnya akan dikabarkan oleh tim rekrutmen melalui email.
            </p>
            <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
              <CheckCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Anda dapat menutup jendela browser ini sekarang.</span>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ── States B/C/D/E: Active interview ────────────────────────────────────
  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col">
      {/* Top bar */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-30 shadow-2xs">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-xs">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-bold text-slate-900">Rakamin AI</span>
          </div>
          {candidateInfo && (
            <InterviewTimer
              totalSeconds={candidateInfo.time_limit_min * 60}
              running={interviewState === "active"}
              onExpired={endInterview}
            />
          )}
        </div>
      </header>

      {/* Main Interview Live Area */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col">
        {/* Reconnecting banner */}
        {interviewState === "reconnecting" && (
          connectionLostLong ? (
            <div className="flex items-center gap-2 text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 mb-4 shadow-xs">
              <span className="animate-pulse text-rose-600 font-bold">●</span>
              <span>Connection is taking too long to restore. Please wait, and contact the recruiter if this persists.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 mb-4 shadow-xs">
              <span className="animate-pulse text-amber-600 font-bold">●</span>
              <span>Briefly reconnecting audio session — please wait a moment.</span>
            </div>
          )
        )}

        {/* Reconnected prompt */}
        {reconnectedPrompt && (
          <div className="flex items-center justify-between text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 mb-4 shadow-xs">
            <span>Reconnected — please say <strong>"check"</strong> or continue your answer to resume.</span>
            <button className="ml-3 text-blue-500 hover:text-blue-700 font-bold cursor-pointer" onClick={() => setReconnectedPrompt(false)}>✕</button>
          </div>
        )}

        {/* Voice indicator visualizer */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
          {interviewState === "connecting" ? (
            <div className="text-sm font-medium text-slate-500 animate-pulse flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary animate-spin" />
              <span>Connecting to AI Interviewer...</span>
            </div>
          ) : interviewState === "draining_audio" ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <VoiceBars active={true} label="AI speaking" variant="ai" />
              <p className="text-xs text-muted-foreground">Finalizing conversation turn...</p>
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
                <div className="w-full space-y-2 overflow-y-auto max-h-[45vh] p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                  {transcript.map((turn, i) => (
                    <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Bottom control bar */}
      <footer className="border-t border-slate-200/80 bg-white/95 backdrop-blur-md sticky bottom-0 z-30 py-3">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between gap-4">
          <ConnectionStatus state={wsConnectionStatus} />

          <div className="flex items-center gap-2.5">
            <Button
              variant={micMuted ? "destructive" : "outline"}
              size="sm"
              onClick={toggleMic}
              className="h-9 px-3 text-xs font-semibold shadow-xs cursor-pointer"
            >
              {micMuted ? (
                <><MicOff className="h-3.5 w-3.5 mr-1.5" /> Muted</>
              ) : (
                <><Mic className="h-3.5 w-3.5 mr-1.5 text-primary" /> Mic Active</>
              )}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-3 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-slate-200 cursor-pointer">
                  End Interview
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-lg font-bold text-slate-900">
                    End interview session?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm text-muted-foreground">
                    Are you sure you want to conclude the interview? Your answers up to this point will be submitted for review.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={endInterview} className="bg-rose-600 hover:bg-rose-700 text-white font-semibold">
                    End Interview
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </footer>
    </div>
  );
}
