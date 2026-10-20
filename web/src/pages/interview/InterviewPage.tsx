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
import ParticipantTiles from "@/components/interview/ParticipantTiles";
import DeviceSettingsModal from "@/components/interview/DeviceSettingsModal";
import LiveCaptionsOverlay from "@/components/interview/LiveCaptionsOverlay";
import TranscriptDrawer from "@/components/interview/TranscriptDrawer";
import InterviewTimer from "@/components/interview/InterviewTimer";
import ConnectionStatus from "@/components/interview/ConnectionStatus";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { sessionsApi } from "@/services/sessions";
import HardwareCheck from "@/components/HardwareCheck";
import {
  AlertCircle,
  CheckCircle,
  Mic,
  MicOff,
  MessageSquare,
  Subtitles,
  Settings as SettingsIcon,
  PhoneOff,
  Info,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [unreadTranscriptCount, setUnreadTranscriptCount] = useState(0);
  const [isDeviceSettingsOpen, setIsDeviceSettingsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false); // kept for green banner
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  // Fetch candidate info
  useEffect(() => {
    if (!token) return;
    sessionsApi.getCandidateInfo(token)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        if (res.data.consent_given) setConsentAgreed(true);
        if (res.data.candidate_name) setEditedName(res.data.candidate_name);
        if (res.data.session_status === "ended") {
          if (res.data.end_reason === "error") {
            setInterviewState("error");
          } else {
            setInterviewState("complete");
          }
        }
      })
      .catch(() => setInterviewState("error"));
  }, [token]);

  const handleUpdateName = async () => {
    if (!token || !editedName.trim()) return;
    try {
      setIsUpdatingName(true);
      await sessionsApi.updateCandidate(token, { candidate_name: editedName.trim() });
      setCandidateInfo((prev) => (prev ? { ...prev, candidate_name: editedName.trim() } : prev));
      setIsEditingName(false);
    } catch {
      // Retain previous state on error
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleConsentToggle = async (checked: boolean) => {
    setConsentAgreed(checked);
    if (token && checked) {
      try {
        await sessionsApi.updateCandidate(token, { consent_given: true });
        setCandidateInfo((prev) => (prev ? { ...prev, consent_given: true } : prev));
      } catch {
        // Retain optimistic state to avoid blocking candidate on transient network issues
      }
    }
  };

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  const handleStateChange = useCallback((state: InterviewState) => {
    setInterviewState(state);

    if (state === "active") {
      setRetryCount(0);
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
  }, []);

  const handleReconnected = useCallback(() => {
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    setReconnectedPrompt(true);
    reconnectedPromptTimerRef.current = setTimeout(() => setReconnectedPrompt(false), 10_000);
  }, []);

  const handleTranscript = useCallback((turn: Pick<TranscriptTurn, "speaker" | "text">) => {
    setTranscript((prev) => [...prev.slice(-19), turn]);
    setIsTranscriptOpen((isOpen) => {
      if (!isOpen) {
        setUnreadTranscriptCount((c) => c + 1);
      }
      return isOpen;
    });
  }, []);

  const { playChunk, stop: stopPlayback, scheduleAfterPlayback, waitForDrain, cancelDrain, getVolume: getAiVolume } = useAudioPlayback();
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

  const { start: startCapture, stop: stopCapture, mute, unmute, getVolume: getCandidateVolume } = useAudioCapture({
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
    if (!sessionId || !consentAgreed) return;
    setInterviewState("connecting");
    connect();
    await startCapture();
    // Start muted — only unmute when backend sends speaker_changed: candidate.
    // This prevents mic audio from being sent during AI speech, since separate
    // AudioContexts for capture/playback break the browser's echo cancellation.
    muteRef.current?.();
  }, [sessionId, consentAgreed, connect, startCapture]);

  const endInterview = useCallback(async () => {
    setInterviewState("ending");
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    stopCapture();
    stopPlayback();
    sendJson({ type: "end_session" });
    disconnect();
    if (token) {
      Promise.resolve(sessionsApi.audioComplete(token)).catch(() => {});
    }
    setInterviewState("complete");
  }, [stopCapture, stopPlayback, sendJson, disconnect, token]);

  const handleRetryConnection = useCallback(async () => {
    if (retryCount >= 1) {
      if (token) {
        Promise.resolve(sessionsApi.audioComplete(token)).catch(() => {});
      }
      setInterviewState("complete");
      return;
    }

    setIsRetrying(true);
    try {
      if (!token) {
        setInterviewState("complete");
        return;
      }

      const res = await sessionsApi.getCandidateInfo(token);
      setCandidateInfo(res.data);

      if (res.data.session_status === "ended") {
        setInterviewState("complete");
        return;
      }

      setRetryCount((prev) => prev + 1);
      setInterviewState("connecting");
      connect();
    } catch {
      setRetryCount((prev) => prev + 1);
      setInterviewState("connecting");
      connect();
    } finally {
      setIsRetrying(false);
    }
  }, [retryCount, token, connect]);

  const wsConnectionStatus =
    interviewState === "reconnecting"
      ? connectionLostLong ? "lost" : "reconnecting"
      : connectionState === "connected"
      ? "connected"
      : "reconnecting";

  // Pre-start state
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

        {/* Candidate Identity Card */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Data Kandidat
            </span>
            {!isEditingName && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary"
                onClick={() => {
                  setEditedName(candidateInfo?.candidate_name || "");
                  setIsEditingName(true);
                }}
              >
                Koreksi Nama
              </Button>
            )}
          </div>

          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Masukkan nama lengkap"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={isUpdatingName}
              />
              <Button
                size="sm"
                className="h-9"
                onClick={handleUpdateName}
                disabled={isUpdatingName || !editedName.trim()}
              >
                Simpan
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setIsEditingName(false)}
                disabled={isUpdatingName}
              >
                Batal
              </Button>
            </div>
          ) : (
            <p className="text-sm font-medium text-foreground">
              Selamat datang,{" "}
              <span className="font-semibold text-primary">
                {candidateInfo?.candidate_name || "Kandidat"}
              </span>
            </p>
          )}
        </div>

        {/* UU PDP Consent Gate */}
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="consent-checkbox"
              checked={consentAgreed}
              onChange={(e) => handleConsentToggle(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                Persetujuan Pemrosesan Data Pribadi & Rekaman Audio
              </p>
              <p>
                Saya menyetujui pemrosesan data pribadi dan perekaman audio selama wawancara berlangsung
                untuk keperluan evaluasi kompetensi sesuai ketentuan UU Pelindungan Data Pribadi (UU PDP No. 27/2022).
              </p>
            </div>
          </label>
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
              consentAgreed={consentAgreed}
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
            <Button
              className="w-full"
              size="lg"
              disabled={!consentAgreed}
              onClick={startInterview}
            >
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
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-semibold">Interview Complete</h2>
        <p className="text-sm text-muted-foreground">
          Thank you. The interview has been recorded.
          <br />
          The hiring team will review your results and follow up with you.
        </p>
      </div>
    );
  }

  if (interviewState === "replaced") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-semibold">Active in Another Window</h2>
        <p className="text-sm text-muted-foreground">
          This interview session was opened in another browser tab or window.
          <br />
          This window has been disconnected to prevent audio conflicts.
        </p>
      </div>
    );
  }

  // ── State G: Error / Connection Interrupted ─────────────────────────────
  if (interviewState === "error") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-semibold">Connection Interrupted</h2>
        <p className="text-sm text-muted-foreground">
          {retryCount >= 1
            ? "The interview connection could not be restored. You can finalize your interview now."
            : "A network or server error interrupted the interview connection. You can try reconnecting to continue where you left off."}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
          <Button
            onClick={handleRetryConnection}
            disabled={isRetrying}
          >
            {isRetrying ? "Checking connection..." : "Retry Connection"}
          </Button>
          {retryCount >= 1 && (
            <Button
              variant="outline"
              disabled={isRetrying}
              onClick={() => {
                if (token) {
                  Promise.resolve(sessionsApi.audioComplete(token)).catch(() => {});
                }
                setInterviewState("complete");
              }}
            >
              Finish Interview
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── States B/C/D/E: Active interview ────────────────────────────────────
  const roomCode = token
    ? `${token.slice(0, 3)}-${token.slice(3, 7)}-${token.slice(7, 10)}`
    : "interview-room";
  const candidateInitials = candidateInfo?.candidate_name
    ? candidateInfo.candidate_name.slice(0, 1).toUpperCase()
    : "K";

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 text-slate-900 overflow-hidden select-none">
      {/* ── Top Bar (Google Meet Header — Clean, Not Forced Dark) ── */}
      <header className="h-12 border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between bg-white shrink-0 z-20">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-700 font-medium tracking-wider">
            {currentTime || "13:48"}
          </span>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <span className="font-mono font-medium">{roomCode}</span>
            <span className="text-slate-400 text-[11px]">
              ({candidateInfo?.assessment_name || "Assessment"})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {candidateInfo && (
            <InterviewTimer
              totalSeconds={candidateInfo.time_limit_min * 60}
              running={interviewState === "active"}
              onExpired={endInterview}
            />
          )}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
            <div className="w-7 h-7 rounded-full bg-purple-700 flex items-center justify-center text-xs font-bold text-white shadow-sm">
              {candidateInitials}
            </div>
            <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <Users className="w-3 h-3" /> 2
            </span>
          </div>
        </div>
      </header>

      {/* Reconnecting / Grace Banner */}
      {interviewState === "reconnecting" && (
        connectionLostLong ? (
          <div className="flex items-center gap-2 text-xs bg-red-50 border-b border-red-200 text-red-800 px-4 py-2 shrink-0">
            <AlertCircle className="h-3.5 w-3.5 animate-pulse shrink-0" />
            <span>Connection interrupted. Attempting to restore session...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2 shrink-0">
            <AlertCircle className="h-3.5 w-3.5 animate-pulse shrink-0" />
            <span>Briefly reconnecting audio channel — please wait.</span>
          </div>
        )
      )}

      {/* ── Main Stage (2 Participant Conference Squares) ── */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-slate-100/80">
        {interviewState === "connecting" ? (
          <div className="flex flex-col items-center gap-2 text-slate-500 animate-pulse text-sm">
            <span>Connecting to interview room...</span>
          </div>
        ) : (
          <ParticipantTiles
            candidateName={candidateInfo?.candidate_name}
            speaker={speaker}
            micMuted={micMuted}
            getAiVolume={getAiVolume}
            getCandidateVolume={getCandidateVolume}
          />
        )}

        {/* Floating Captions (CC) Overlay */}
        <div className="absolute bottom-4 left-0 right-0 z-20 pointer-events-none">
          <div className="pointer-events-auto">
            <LiveCaptionsOverlay
              latestTurn={transcript[transcript.length - 1]}
              enabled={showCaptions}
            />
          </div>
        </div>
      </div>

      {/* ── Bottom Controls Bar (Google Meet Floating Pill) ── */}
      <footer className="h-16 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-white border-t border-slate-200 z-20">
        <div className="flex items-center gap-3">
          <ConnectionStatus state={wsConnectionStatus} />
        </div>

        {/* Centered Meeting Action Pill */}
        <div className="flex items-center gap-2 sm:gap-3 bg-slate-100 p-1 rounded-full border border-slate-200/80">
          {/* Microphone Toggle Button */}
          <button
            type="button"
            onClick={toggleMic}
            className={`p-2.5 sm:p-3 rounded-full transition-all duration-150 ${
              micMuted
                ? "bg-red-600 text-white hover:bg-red-700 shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 shadow-sm"
            }`}
            title={micMuted ? "Unmute microphone" : "Mute microphone"}
            aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {micMuted ? <MicOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Mic className="h-4 w-4 sm:h-5 sm:w-5" />}
          </button>

          {/* Audio & Mic Settings Button */}
          <button
            type="button"
            onClick={() => setIsDeviceSettingsOpen(true)}
            className="p-2.5 sm:p-3 rounded-full bg-white text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 shadow-sm transition-colors"
            title="Microphone & Audio Device Settings"
            aria-label="Microphone & Audio Device Settings"
          >
            <SettingsIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* Closed Captions Button */}
          <button
            type="button"
            onClick={() => setShowCaptions((prev) => !prev)}
            className={`p-2.5 sm:p-3 rounded-full transition-colors ${
              showCaptions
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 shadow-sm"
            }`}
            title={showCaptions ? "Hide closed captions" : "Show closed captions"}
            aria-label={showCaptions ? "Hide closed captions" : "Show closed captions"}
          >
            <Subtitles className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* End Call Button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="p-2.5 sm:p-3 px-4 sm:px-5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-1.5 shadow-sm"
                title="End interview"
                aria-label="End interview"
              >
                <PhoneOff className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-xs font-semibold">End</span>
              </button>
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
        </div>

        {/* Right Control: In-Call Messages / Transcript Drawer */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsTranscriptOpen((prev) => !prev);
              setUnreadTranscriptCount(0);
            }}
            className={`p-2.5 sm:p-3 rounded-full relative transition-colors ${
              isTranscriptOpen
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 shadow-sm"
            }`}
            title="In-call messages"
            aria-label="In-call messages"
          >
            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
            {unreadTranscriptCount > 0 && !isTranscriptOpen && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-red-500 text-white text-[10px] font-bold rounded-full">
                {unreadTranscriptCount}
              </span>
            )}
          </button>
        </div>
      </footer>

      {/* Working Device & Mic Settings Modal */}
      <DeviceSettingsModal
        open={isDeviceSettingsOpen}
        onOpenChange={setIsDeviceSettingsOpen}
      />

      {/* Slide-out In-Call Messages Transcript Drawer */}
      <TranscriptDrawer
        open={isTranscriptOpen}
        onClose={() => setIsTranscriptOpen(false)}
        transcript={transcript}
      />
    </div>
  );
}
