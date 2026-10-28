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
// ConnectionStatus removed in favor of unified NetworkHealthPill
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
  Clock,
  Sparkles,
  ShieldCheck,
  Volume2,
  RefreshCw,
  X,
} from "lucide-react";
import IncidentCard from "@/components/interview/molecules/IncidentCard";
import SpeakerStatePill from "@/components/interview/atoms/SpeakerStatePill";
import NetworkHealthPill from "@/components/interview/atoms/NetworkHealthPill";
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
        if (res.data.session_status === "ended") {
          if (res.data.end_reason === "error") {
            setInterviewState("error");
          } else {
            setInterviewState("complete");
          }
        }
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
    if (connectionLostTimerRef.current) clearTimeout(connectionLostTimerRef.current);
    stopCapture();
    stopPlayback();
    try {
      sendJson({ type: "end_session" });
    } catch {
      // safe fallback if socket not open
    }
    if (sessionId) {
      sessionsApi.endSession(sessionId, "manual_candidate").catch(() => {});
    }
    disconnect();
    setInterviewState("complete");
  }, [sessionId, stopCapture, stopPlayback, sendJson, disconnect]);

  const wsConnectionStatus =
    interviewState === "reconnecting"
      ? connectionLostLong ? "lost" : "reconnecting"
      : connectionState === "connected"
      ? "connected"
      : "reconnecting";

  // ── State A: Pre-start ──────────────────────────────────────────────────
  if (interviewState === "idle") {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50/70 py-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Top Headline Banner */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
              {candidateInfo?.role_title ?? "Sesi Wawancara AI"}
            </h1>
            <div className="flex items-center justify-center gap-3 text-xs sm:text-sm text-neutral-600">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4 text-neutral-500" />
                Alokasi waktu: {candidateInfo?.time_limit_min ?? 10} menit
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Rekaman tersimpan otomatis
              </span>
            </div>
          </div>

          {!hardwareCheckDone ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Briefing & Rules */}
              <div className="lg:col-span-5 bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-neutral-900">
                    Panduan & Ketentuan Sesi
                  </h2>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    Harap membaca petunjuk berikut sebelum memulai sesi wawancara suara otomatis:
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/80 space-y-1">
                    <p className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                      <Volume2 className="h-3.5 w-3.5 text-neutral-600" />
                      Lingkungan Tenang
                    </p>
                    <p className="text-xs text-neutral-600 leading-normal">
                      Pastikan Anda berada di ruangan yang hening dan gunakan headset/headphone untuk kualitas audio optimal.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/80 space-y-1">
                    <p className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                      <Mic className="h-3.5 w-3.5 text-neutral-600" />
                      Percakapan Alami
                    </p>
                    <p className="text-xs text-neutral-600 leading-normal">
                      AI akan mengajukan pertanyaan secara adaptif sesuai jawaban Anda (tanpa naskah hafalan yang kaku).
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/80 space-y-1">
                    <p className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-neutral-600" />
                      Kendali Sesi
                    </p>
                    <p className="text-xs text-neutral-600 leading-normal">
                      Mikrofon akan aktif selama giliran Anda berbicara. Anda bebas mengakhiri wawancara kapan saja.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Hardware Checklist */}
              <div className="lg:col-span-7">
                <HardwareCheck
                  onStart={() => {
                    setHardwareCheckDone(true);
                    startInterview();
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto bg-white border border-neutral-200 rounded-xl p-6 shadow-sm text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 font-medium">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Pemeriksaan perangkat lolos. Sistem siap memulai.</span>
              </div>
              <Button className="w-full h-11 text-sm bg-neutral-900 hover:bg-neutral-800 text-white font-medium" size="lg" onClick={startInterview}>
                <Mic className="h-4 w-4 mr-2" />
                Mulai Wawancara Sekarang
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── State E: Error / Incident Recovery ──────────────────────────────────
  if (interviewState === "error") {
    return (
      <IncidentCard
        token={token}
        sessionId={sessionId ?? candidateInfo?.session_id}
        onRetry={startInterview}
      />
    );
  }

  // ── State F: Complete ───────────────────────────────────────────────────
  if (interviewState === "complete") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-5" data-testid="completion-card">
        <div className="flex justify-center">
          <div className="p-3.5 rounded-full bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-neutral-900 tracking-tight">Interview Complete</h2>
          <p className="text-sm text-neutral-600 max-w-md mx-auto leading-relaxed">
            Terima kasih. Sesi wawancara telah selesai dan seluruh jawaban Anda telah tersimpan dengan aman di sistem.
          </p>
        </div>
        <p className="text-xs text-neutral-500">
          Tim hiring akan mereview hasil wawancara dan memberikan kabar lanjutan kepada Anda.
        </p>
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
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">AI Interview</span>
          <NetworkHealthPill
            state={
              interviewState === "reconnecting"
                ? "reconnecting"
                : connectionState === "connected"
                ? "connected"
                : "offline"
            }
          />
        </div>
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
          <div className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2.5 mt-2">
            <span className="animate-pulse">●</span>
            <span>Sedang menyambungkan ulang koneksi. Mohon tunggu sejenak.</span>
          </div>
        )
      )}

      {/* Reconnected prompt */}
      {reconnectedPrompt && (
        <div className="flex items-center justify-between text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-2.5 mt-2">
          <span>Terhubung kembali. Silakan katakan <strong>"halo"</strong> atau lanjutkan jawaban Anda.</span>
          <button
            type="button"
            className="ml-3 p-1 text-blue-600 hover:text-blue-800 shrink-0 rounded"
            onClick={() => setReconnectedPrompt(false)}
            aria-label="Tutup notifikasi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Voice indicator */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
        <SpeakerStatePill
          state={
            aiSpeaking
              ? "ai"
              : candidateSpeaking
              ? "candidate"
              : interviewState === "connecting" || interviewState === "draining_audio"
              ? "processing"
              : "idle"
          }
        />
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
      <div className="border-t border-neutral-200 py-3.5 px-4 flex items-center justify-between gap-4 sticky bottom-0 bg-white/95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Button
            variant={micMuted ? "destructive" : "outline"}
            size="sm"
            onClick={toggleMic}
            className="gap-1.5"
          >
            {micMuted ? (
              <><MicOff className="h-3.5 w-3.5" /> Mikrofon Mati</>
            ) : (
              <><Mic className="h-3.5 w-3.5" /> Mikrofon Aktif</>
            )}
          </Button>

          {import.meta.env.DEV && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 text-neutral-600 hover:text-neutral-900 border-neutral-300 bg-white"
              onClick={() => sendJson({ type: "debug_force_reconnect" })}
            >
              <RefreshCw className="h-3 w-3 text-neutral-500" />
              Reconnect Sesi
            </Button>
          )}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-neutral-700 hover:text-rose-700 hover:border-rose-300">
              Akhiri Wawancara
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Akhiri Wawancara Sekarang?</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin mengakhiri sesi wawancara lebih awal? Seluruh transkrip dan rekaman jawaban yang telah tersampaikan sebelum ini tetap tersimpan dengan aman di server.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={endInterview} className="bg-rose-600 hover:bg-rose-700 text-white font-medium">
                Ya, Akhiri Wawancara
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

    </div>
  );
}
