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
import AiLiveOrb from "@/components/interview/AiLiveOrb";
import InterviewTimer from "@/components/interview/InterviewTimer";
import ConnectionStatus from "@/components/interview/ConnectionStatus";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { useWakeLock } from "@/hooks/useWakeLock";
import { sessionsApi } from "@/services/sessions";
import HardwareCheck from "@/components/HardwareCheck";
import PrivacyConsentModal from "@/components/interview/PrivacyConsentModal";
import {
  CheckCircle,
  Mic,
  MicOff,
  ShieldCheck,
  Radio,
  Clock,
  Sparkles,
  Award,
  ChevronRight,
  AlertTriangle,
  Sun
} from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);

  // Keep screen awake during active interview session (Screen Wake Lock API)
  const isInterviewOngoing = interviewState !== "idle" && interviewState !== "complete";
  const { isActive: isScreenAwake } = useWakeLock({
    enabled: isInterviewOngoing,
  });

  // Auto-scroll refs for transcript chat stream
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    } else if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTo({
        top: transcriptContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  // Auto scroll to latest chat whenever transcript updates (especially on AI responses)
  useEffect(() => {
    if (transcript.length === 0) return;
    scrollToBottom(true);
  }, [transcript, scrollToBottom]);

  // Fetch candidate info
  useEffect(() => {
    if (!token) return;
    sessionsApi
      .getCandidateInfo(token)
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

    if (state === "complete") {
      stopCapture();
      stopPlayback();
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
    setTranscript((prev) => [...prev.slice(-49), turn]);
  }, []);

  const { playChunk, stop: stopPlayback, scheduleAfterPlayback, waitForDrain, cancelDrain } =
    useAudioPlayback();
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

  const handleSpeakerChange = useCallback(
    (newSpeaker: InterviewSpeaker) => {
      if (newSpeaker === "ai") {
        setSpeaker("ai");
        muteRef.current?.();
      } else if (newSpeaker === "candidate") {
        scheduleAfterPlayback(() => {
          setSpeaker("candidate");
          if (!micMutedRef.current) unmuteRef.current?.();
        });
      }
    },
    [scheduleAfterPlayback]
  );

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

  // Ensure microphone and audio playback are terminated when session completes or component unmounts
  useEffect(() => {
    if (interviewState === "complete" || interviewState === "ending") {
      stopCapture();
      stopPlayback();
    }
    return () => {
      stopCapture();
      stopPlayback();
    };
  }, [interviewState, stopCapture, stopPlayback]);

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
      ? connectionLostLong
        ? "lost"
        : "reconnecting"
      : connectionState === "connected"
      ? "connected"
      : "reconnecting";

  // ── State A: Pre-start ──────────────────────────────────────────────────
  if (interviewState === "idle") {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200/80 px-3 py-1 rounded-full">
            <Radio className="h-3 w-3 text-teal-600 animate-pulse" /> Sesi Wawancara AI Mandiri
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {candidateInfo?.role_title ?? "Wawancara Teknis"}
          </h1>
          {candidateInfo && (
            <p className="text-xs text-slate-500 font-medium">
              Alokasi Waktu Maksimum: <strong className="text-slate-800">{candidateInfo.time_limit_min} Menit</strong>
            </p>
          )}
        </div>

        <PrivacyConsentModal
          open={!consentGiven}
          onConsentAccepted={() => setConsentGiven(true)}
          roleTitle={candidateInfo?.role_title}
        />

        {consentGiven && (
          <div className="flex items-center gap-2.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 shadow-2xs">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Persetujuan pemrosesan audio &amp; evaluasi kompetensi AI sesuai ketentuan UU PDP telah terverifikasi.</span>
          </div>
        )}

        {!hardwareCheckDone ? (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 text-xs text-slate-600 space-y-2.5 shadow-xs">
              <div className="font-semibold text-slate-900 text-sm mb-1">
                Petunjuk Sebelum Memulai:
              </div>
              <p>• Sesi ini menggunakan interaksi audio suara langsung dua arah. Pastikan Anda berada di ruangan yang tenang.</p>
              <p>• AI akan mengajukan pertanyaan teknis lanjutan secara adaptif berdasarkan jawaban Anda.</p>
              <p>• Waktu maksimum sesi adalah {candidateInfo?.time_limit_min ?? "—"} menit.</p>
              <p>• Anda dapat mengakhiri sesi kapan saja dengan menekan tombol "Akhiri Wawancara".</p>
            </div>

            {consentGiven ? (
              <HardwareCheck
                onStart={() => {
                  setHardwareCheckDone(true);
                  startInterview();
                }}
              />
            ) : (
              <Button
                className="w-full h-11 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm shadow-sm"
                onClick={() => setConsentGiven(false)}
              >
                Tinjau Ketentuan Privasi UU PDP untuk Memulai
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-2xs">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Pemeriksaan mikrofon dan koneksi internet lolos. Anda siap untuk memulai.</span>
            </div>
            <Button
              className="w-full h-12 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-md"
              onClick={startInterview}
            >
              <Mic className="h-4 w-4 mr-2" />
              Mulai Sesi Wawancara
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── State F: Complete ───────────────────────────────────────────────────
  if (interviewState === "complete") {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-teal-50 border border-teal-200 rounded-3xl flex items-center justify-center mx-auto text-teal-700">
          <Award className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Wawancara Selesai
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
            Terima kasih atas waktu dan dedikasi Anda. Seluruh bukti jawaban teknis Anda telah tercatat dengan aman dan sedang dianalisis oleh AI evaluator.
          </p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 text-xs text-slate-600 text-left space-y-1.5 shadow-xs max-w-md mx-auto">
          <div className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
            Langkah Selanjutnya:
          </div>
          <p>• Tim hiring Rakamin akan meninjau laporan portfolio kompetensi dan kecocokan profil Anda.</p>
          <p>• Kabar mengenai status seleksi akan disampaikan melalui email resmi.</p>
        </div>
      </div>
    );
  }

  // ── States B/C/D/E: Active interview ────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 flex flex-col h-full flex-1 justify-between py-4 space-y-4">
      {/* Top Session Bar */}
      <div className="flex items-center justify-between py-2.5 px-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
          <span className="text-xs font-bold text-slate-900 truncate max-w-[160px] sm:max-w-xs">
            {candidateInfo?.role_title ?? "AI Interview"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isScreenAwake && (
            <div
              title="Layar tetap menyala selama sesi wawancara aktif"
              className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 rounded-full"
            >
              <Sun className="h-3 w-3 text-teal-600 animate-pulse" />
              <span>Layar Terjaga</span>
            </div>
          )}

          {candidateInfo && (
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <InterviewTimer
                totalSeconds={candidateInfo.time_limit_min * 60}
                running={interviewState === "active"}
                onExpired={endInterview}
              />
            </div>
          )}
        </div>
      </div>

      {/* Reconnecting banner */}
      {interviewState === "reconnecting" && (
        <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-2.5 animate-pulse">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>Koneksi sedang dipulihkan secara otomatis, mohon tunggu sejenak...</span>
        </div>
      )}

      {/* Interactive AI Presence Orb */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-6 min-h-[300px]">
        <AiLiveOrb speaker={speaker} state={interviewState} />

        {/* Live Transcript Stream */}
        {transcript.length > 0 && (
          <div
            ref={transcriptContainerRef}
            className="w-full space-y-2.5 overflow-y-auto max-h-[42vh] p-1 scroll-smooth custom-scrollbar"
          >
            {transcript.map((turn, i) => (
              <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
            ))}
            <div ref={transcriptEndRef} className="h-px w-full" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="border border-slate-200 rounded-2xl p-3 bg-white shadow-sm flex items-center justify-between gap-3">
        <ConnectionStatus state={wsConnectionStatus} />

        <div className="flex items-center gap-2">
          <Button
            variant={micMuted ? "destructive" : "outline"}
            size="sm"
            onClick={toggleMic}
            className="rounded-xl text-xs h-9 px-3"
          >
            {micMuted ? (
              <><MicOff className="h-3.5 w-3.5 mr-1.5" /> Mic Nonaktif</>
            ) : (
              <><Mic className="h-3.5 w-3.5 mr-1.5 text-teal-700" /> Mic Aktif</>
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-xs h-9 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 border-slate-200"
              >
                Akhiri Sesi
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-base font-bold text-slate-900">
                  Akhiri sesi wawancara?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-slate-500">
                  Apakah Anda yakin ingin mengakhiri sesi wawancara sekarang? Seluruh jawaban yang telah Anda sampaikan akan dievaluasi untuk penilaian akhir.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:gap-0">
                <AlertDialogCancel className="rounded-xl text-xs">Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={endInterview}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs"
                >
                  Ya, Akhiri Wawancara
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
