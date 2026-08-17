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
import { CheckCircle, FileWarningIcon, Mic, MicOff, Clock, AlertTriangle, ArrowDown } from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [candidateInfoLoading, setCandidateInfoLoading] = useState(true);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<(Pick<TranscriptTurn, "speaker" | "text"> & { turn_number?: number })[]>([]);
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);
  const [interviewError, setInterviewError] = useState<string | null>(null);

  // Fetch candidate info
  useEffect(() => {
    if (!token) {
      setCandidateInfoLoading(false);
      setInterviewState("error");
      return;
    }
    sessionsApi.getCandidateInfo(token)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        if (res.data.recent_turns && res.data.recent_turns.length > 0) {
          setTranscript(res.data.recent_turns);
        }
        if (res.data.session_status === "ended") {
          setInterviewState("complete");
        } else if (res.data.session_status === "active") {
          setInterviewState("active");
        }
      })
      .catch(() => setInterviewState("error"))
      .finally(() => setCandidateInfoLoading(false));
  }, [token]);

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  const handleStateChange = useCallback((state: InterviewState, message?: string) => {
    if (state === "complete") {
      setInterviewError(null);
      setInterviewState("complete");
      playbackCancelRef.current?.();
      playbackCancelRef.current = null;
      if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
      return;
    }

    if (message) setInterviewError(message);
    setInterviewState(state);

    if (state === "active") {
      setInterviewError(null);
      setCandidateInfo((prev) => prev ? { ...prev, started_at: prev.started_at || new Date().toISOString() } : prev);
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

  const handleTranscript = useCallback((turn: Pick<TranscriptTurn, "speaker" | "text"> & { turn_number?: number }) => {
    setTranscript((prev) => {
      if (!turn.turn_number) {
        return [...prev, turn];
      }
      const existingIndex = prev.findIndex((t) => t.turn_number === turn.turn_number);
      if (existingIndex >= 0) {
        if (prev[existingIndex].text === turn.text && prev[existingIndex].speaker === turn.speaker) {
          return prev; // No change, avoid unnecessary state update
        }
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          text: turn.text,
          speaker: turn.speaker,
        };
        return updated;
      }
      return [...prev, turn];
    });
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

  // Cancel handle for the deferred "candidate turn" timer — a stale timer must
  // never flip the indicator (or unmute the mic) mid-AI-turn.
  const playbackCancelRef = useRef<(() => void) | null>(null);

  const handleSpeakerChange = useCallback((newSpeaker: InterviewSpeaker) => {
    playbackCancelRef.current?.();
    playbackCancelRef.current = null;

    if (newSpeaker === "ai") {
      setSpeaker("ai");
      muteRef.current?.();
    } else if (newSpeaker === "candidate") {
      playbackCancelRef.current = scheduleAfterPlayback(() => {
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

  // Auto-reconnect on refresh if session is already active
  const autoReconnectedRef = useRef(false);
  useEffect(() => {
    if (candidateInfo?.session_status === "active" && sessionId && !autoReconnectedRef.current) {
      autoReconnectedRef.current = true;
      connect();
      startCapture().then(() => muteRef.current?.());
    }
  }, [candidateInfo?.session_status, sessionId, connect, startCapture]);

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
    setInterviewError(null);
    setInterviewState("complete");
    playbackCancelRef.current?.();
    playbackCancelRef.current = null;
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    stopCapture();
    stopPlayback();
    sendJson({ type: "end_session" });
    disconnect();
    if (token) {
      sessionsApi.audioComplete(token).catch(() => {});
    }
  }, [stopCapture, stopPlayback, sendJson, disconnect, token]);

  // Keep the newest bubble in view as the transcript grows with smart user scroll detection.
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const handleScroll = useCallback(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    const isScrolledUp = el.scrollHeight - el.scrollTop - el.clientHeight > 80;
    setShowScrollBottom(isScrolledUp);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = transcriptScrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      setShowScrollBottom(false);
    }
  }, []);

  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    // Auto scroll down if user is near bottom
    const isScrolledUp = el.scrollHeight - el.scrollTop - el.clientHeight > 120;
    if (!isScrolledUp) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [transcript]);

  const wsConnectionStatus =
    connectionState === "connected" && interviewState !== "reconnecting"
      ? "connected"
      : connectionLostLong
      ? "lost"
      : "reconnecting";

  // ── State A: Welcome ────────────────────────────────────────────────────
  if (interviewState === "idle") {
    return (
      <div className="bg-card border rounded-2xl shadow-sm p-6 sm:p-8 flex flex-col h-full overflow-y-auto justify-between space-y-6">
        <div className="text-center space-y-1.5 pt-2">
          <h1 className="text-xl font-semibold">{candidateInfo?.role_title ?? "AI Interview"}</h1>
          {candidateInfo && (
            <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{candidateInfo.time_limit_min} menit</span>
            </div>
          )}
        </div>

        {candidateInfoLoading ? (
          <p className="text-center text-sm text-muted-foreground animate-pulse py-8">
            Memuat informasi wawancara...
          </p>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/40 rounded-lg p-4 text-sm space-y-2 text-muted-foreground">
              <p>Ini adalah wawancara berbasis suara dengan AI. AI akan menilai kemampuanmu berdasarkan percakapan yang terjadi.</p>
              <p>Tidak ada soal tertulis — cukup jawab pertanyaan dengan suara seperti wawancara biasa.</p>
            </div>

            <div className="bg-muted/40 rounded-lg p-4 text-sm space-y-1.5 text-muted-foreground">
              <p className="font-medium text-foreground">Yang perlu disiapkan:</p>
              <p>• Ruangan yang tenang dan minim gangguan</p>
              <p>• Koneksi internet yang stabil</p>
              <p>• Perangkat dengan mikrofon yang berfungsi</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-xs space-y-1 text-amber-800">
              <div className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Penting</span>
              </div>
              <p>• Jangan gunakan headphone</p>
              <p>• Jangan ada orang lain di ruangan</p>
            </div>

            <div className="space-y-2 pt-2">
              <Button className="w-full" size="lg" onClick={() => setInterviewState("hardware_check")}>
                Lanjutkan
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── State A2: Hardware check ────────────────────────────────────────────
  if (interviewState === "hardware_check") {
    return (
      <div className="bg-card border rounded-2xl shadow-sm p-6 sm:p-8 flex flex-col h-full overflow-y-auto justify-center space-y-6">
        <div className="text-center space-y-1.5">
          <h1 className="text-xl font-semibold">{candidateInfo?.role_title ?? "AI Interview"}</h1>
          {candidateInfo && (
            <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{candidateInfo.time_limit_min} menit</span>
            </div>
          )}
        </div>

        <HardwareCheck onStart={startInterview} />
      </div>
    );
  }

  // ── State F: Complete ───────────────────────────────────────────────────
  if (interviewState === "complete") {
    return (
      <div className="bg-card border rounded-2xl shadow-sm p-8 flex flex-col h-full justify-center items-center text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircle size={"48"} className="text-green-500"/>
        </div>
        <h2 className="text-xl font-semibold">Interview Complete</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Thank you. The interview has been recorded.
          <br />
          The hiring team will review your results and follow up with you.
        </p>
      </div>
    );
  }

  // ── State E: Invalid invite OR system failure ───────────────────────────
  if (interviewState === "error") {
    return (
      <div className="bg-card border rounded-2xl shadow-sm p-8 flex flex-col h-full justify-center items-center text-center space-y-5">
        <div className="flex justify-center">
          <FileWarningIcon size={"48"} className="text-orange-500" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-semibold">
            {interviewError ? "Wawancara Terputus" : "Tautan Tidak Valid"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            {interviewError ? (
              <>
                {interviewError}
                <span className="text-xs text-muted-foreground mt-1 block">
                  Riwayat jawaban dan sisa waktu Anda tetap tersimpan aman.
                </span>
              </>
            ) : (
              <>
                Tautan undangan ini tidak valid atau telah kedaluwarsa.
                <br />
                Silakan hubungi tim rekrutmen untuk tautan baru.
              </>
            )}
          </p>
        </div>

        {interviewError && sessionId && (
          <div className="pt-2 w-full max-w-xs space-y-2">
            <Button
              className="w-full"
              onClick={() => {
                setInterviewError(null);
                setInterviewState("active");
                connect();
                startCapture().then(() => muteRef.current?.());
              }}
            >
              <span>🔄 Sambungkan Kembali</span>
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── States B/C/D/E: Active interview ────────────────────────────────────
  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";

  return (
    <div className="bg-card border rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b bg-card shrink-0">
        <span className="text-sm font-semibold text-foreground truncate max-w-[280px]">
          {candidateInfo?.role_title ?? "AI Interview"}
        </span>
        {candidateInfo && (
          <InterviewTimer
            totalSeconds={candidateInfo.time_limit_min * 60}
            startedAt={candidateInfo.started_at}
            running={interviewState === "active"}
            onExpired={endInterview}
          />
        )}
      </div>

      {interviewState === "reconnecting" && connectionState !== "connected" && (
        <div className="shrink-0 px-4 pt-2">
          {connectionLostLong ? (
            <div className="flex items-center gap-2 text-xs bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2">
              <span className="animate-pulse">●</span>
              <span>Connection taking too long. Please wait or contact support.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-3 py-2">
              <span className="animate-pulse">●</span>
              <span>Reconnecting — please wait a moment.</span>
            </div>
          )}
        </div>
      )}

      {reconnectedPrompt && (
        <div className="shrink-0 px-4 pt-2 flex items-center justify-between text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2">
          <span>Reconnected — say <strong>"check"</strong> to resume.</span>
          <button className="ml-2 text-blue-500 hover:text-blue-700" onClick={() => setReconnectedPrompt(false)}>✕</button>
        </div>
      )}

      <div className="py-6 px-4 border-b bg-muted/15 shrink-0 flex flex-col items-center justify-center min-h-[110px] transition-all">
        {interviewState === "connecting" ? (
          <div className="text-sm text-muted-foreground animate-pulse">Menghubungkan ke AI interviewer...</div>
        ) : interviewState === "draining_audio" ? (
          <div className="flex flex-col items-center gap-1.5 text-center">
            <VoiceBars active={true} label="AI speaking" variant="ai" />
            <p className="text-xs text-muted-foreground">Menyelesaikan rekaman...</p>
          </div>
        ) : (
          <>
            {!candidateSpeaking && (
              <VoiceBars
                active={aiSpeaking}
                label={aiSpeaking ? "AI speaking" : "Listening..."}
                variant="ai"
              />
            )}
            {candidateSpeaking && (
              <VoiceBars
                active={true}
                label="You're speaking"
                variant="candidate"
              />
            )}
          </>
        )}
      </div>

      {/* Transcript container with visible scrollbar & scroll helper */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          ref={transcriptScrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5 bg-slate-50/40 custom-scrollbar scroll-smooth"
        >
          {transcript.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-xs text-muted-foreground p-4">
              Percakapan transkrip langsung akan tampil di sini saat wawancara berjalan.
            </div>
          ) : (
            transcript.map((turn, i) => (
              <TranscriptBubble
                key={turn.turn_number ? `turn-${turn.turn_number}` : `idx-${i}`}
                speaker={turn.speaker}
                text={turn.text}
              />
            ))
          )}
        </div>

        {/* Scroll to bottom button when scrolled up */}
        {showScrollBottom && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={scrollToBottom}
            className="absolute bottom-3 right-4 shadow-md rounded-full text-xs h-7 px-3 gap-1 bg-background/95 backdrop-blur border text-foreground hover:bg-background transition-all animate-in fade-in zoom-in-95 duration-200"
          >
            <ArrowDown className="h-3.5 w-3.5 text-primary" />
            <span>Terbaru</span>
          </Button>
        )}
      </div>

      <div className="border-t px-4 py-3 flex items-center justify-between gap-3 bg-card shrink-0">
        <ConnectionStatus state={wsConnectionStatus} />

        <div className="flex items-center gap-2">
          <Button
            variant={micMuted ? "destructive" : "outline"}
            size="sm"
            onClick={toggleMic}
          >
            {micMuted ? (
              <>
                <MicOff className="h-3.5 w-3.5 mr-1.5" />
                <span>Muted</span>
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5 mr-1.5" />
                <span>Mic On</span>
              </>
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <span>End Interview</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End interview?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to end the interview early?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  <span>Cancel</span>
                </AlertDialogCancel>
                <AlertDialogAction onClick={endInterview}>
                  <span>End interview</span>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
