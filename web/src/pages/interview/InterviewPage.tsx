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
import AIVoiceStage from "@/components/interview/AIVoiceStage";
import InterviewTimer from "@/components/interview/InterviewTimer";
import ConnectionStatus from "@/components/interview/ConnectionStatus";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { sessionsApi } from "@/services/sessions";
import HardwareCheck from "@/components/HardwareCheck";
import { CheckCircle, Mic, MicOff, Sparkles, ShieldCheck, RefreshCw } from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";
import HeroBanner from "@/components/common/HeroBanner";
import { cn } from "@/lib/utils";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
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
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Fetch candidate info
  useEffect(() => {
    if (!token) return;
    sessionsApi.getCandidateInfo(token)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        if (res.data.turns && res.data.turns.length > 0) {
          setTranscript(
            res.data.turns.map((t) => ({
              speaker: t.speaker === "candidate" ? "candidate" : "assessor",
              text: t.text,
            }))
          );
        }
        if (res.data.session_status === "ended") setInterviewState("complete");
      })
      .catch(() => setInterviewState("complete"));
  }, [token]);

  // Auto-scroll transcript feed whenever new messages arrive
  useEffect(() => {
    if (transcript.length > 0) {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcript]);

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
    setTranscript((prev) => [...prev, turn]);
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
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-5 sm:py-8 space-y-6">
        <HeroBanner
          badgeText="⭐️ Sesi Wawancara Teknis Interaktif"
          title={candidateInfo?.role_title ? `Wawancara AI: ${candidateInfo.role_title}` : "AI Technical Interview"}
          highlightText="Rakamin Assessor"
          subtitle="Selamat datang di sesi evaluasi teknis berbasis AI. Sesi ini akan menguji pemahaman dan pengalaman Anda melalui percakapan suara interaktif."
          bulletPoints={[
            `Durasi maksimal sesi: ${candidateInfo?.time_limit_min ?? 45} menit`,
            "Interaksi suara dua arah secara langsung (Real-Time Voice AI)",
            "Pastikan mikrofon aktif dan Anda berada di lingkungan yang tenang",
          ]}
          imageSrc="/images/interview.png"
          imageAlt="Rakamin Candidate Interview"
          imageFloatingBadge={{
            title: "Enkripsi Aman",
            subtitle: "UU PDP No. 27/2022",
          }}
        />

        {!hardwareCheckDone ? (
          <div className="space-y-4">
            <HardwareCheck onStart={() => { setHardwareCheckDone(true); startInterview(); }} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 shadow-xs">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>Pengecekan audio berhasil. Anda siap memulai wawancara.</span>
            </div>
            <Button variant="cta" className="w-full rounded-xl shadow-md font-bold text-base py-6" size="lg" onClick={startInterview}>
              <Mic className="h-5 w-5 mr-2" />
              Mulai Sesi Wawancara AI
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── State F: Complete ───────────────────────────────────────────────────
  if (interviewState === "complete") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24 text-center space-y-6 my-auto">
        <div className="w-20 h-20 rounded-3xl bg-teal-50 text-[#01959f] border border-teal-200/80 flex items-center justify-center mx-auto shadow-md shadow-teal-500/10">
          <CheckCircle className="h-10 w-10 text-[#01959f]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Wawancara Selesai
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-md mx-auto">
            Terima kasih telah menyelesaikan sesi wawancara. Rekaman percakapan dan bukti kompetensi Anda telah tersimpan dengan aman untuk dievaluasi oleh tim asesor.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200 shadow-2xs">
          <ShieldCheck className="h-4 w-4 text-[#01959f]" />
          <span>Sesi Ditutup • Standar UU PDP No. 27/2022</span>
        </div>
      </div>
    );
  }

  // ── States B/C/D/E: Active interview Studio ──────────────────────────────
  return (
    <div className="max-w-6xl mx-auto w-full px-3.5 sm:px-6 py-3 sm:py-5 flex-1 flex flex-col min-h-0">
      {/* Top Header Bar inside Interview Studio */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 sm:mb-4 border-b border-slate-200/90 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                {candidateInfo?.role_title || "AI Technical Interview Session"}
              </h1>
              <span className="text-xs font-bold text-[#01959f] bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 shrink-0">
                AI Interview
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate">
              Kandidat: <span className="font-semibold text-slate-700">{candidateInfo?.candidate_name || "Peserta"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {candidateInfo && (
            <InterviewTimer
              totalSeconds={candidateInfo.time_limit_min * 60}
              running={interviewState === "active"}
              onExpired={endInterview}
            />
          )}
          <ConnectionStatus state={wsConnectionStatus} />
        </div>
      </div>

      {/* Warning/Reconnecting Banners */}
      {interviewState === "reconnecting" && (
        <div className="mb-3 shrink-0">
          {connectionLostLong ? (
            <div className="flex items-center gap-2 text-xs sm:text-sm bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-2.5 shadow-xs">
              <span className="animate-pulse font-bold">●</span>
              <span>Koneksi terputus cukup lama. Mohon tunggu sejenak, atau hubungi perekrut bila masalah berlanjut.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs sm:text-sm bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-2.5 shadow-xs">
              <span className="animate-pulse font-bold">●</span>
              <span>Menghubungkan ulang sesi secara otomatis — mohon tunggu beberapa detik...</span>
            </div>
          )}
        </div>
      )}

      {reconnectedPrompt && (
        <div className="mb-3 shrink-0 flex items-center justify-between text-xs sm:text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-2.5 shadow-2xs">
          <span>Koneksi pulih kembali — silakan katakan <strong>"cek"</strong> atau lanjutkan jawaban Anda.</span>
          <button className="ml-3 text-blue-500 hover:text-blue-700 font-bold shrink-0" onClick={() => setReconnectedPrompt(false)}>✕</button>
        </div>
      )}

      {/* Main Studio Grid: Stage (Left) & Verbatim Transcript (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 flex-1 min-h-0">
        {/* Left Column: AI Voice Holographic Stage */}
        <div className="lg:col-span-5 flex flex-col min-h-0">
          <AIVoiceStage
            speaker={speaker}
            interviewState={interviewState}
            roleTitle={candidateInfo?.role_title}
            micMuted={micMuted}
          />
        </div>

        {/* Right Column: Verbatim Transcript Studio Card */}
        <div className="lg:col-span-7 flex flex-col min-h-0">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm flex flex-col flex-1 h-[420px] sm:h-[480px] lg:h-full overflow-hidden">
            {/* Panel Header */}
            <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between gap-2 sm:gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-800 whitespace-nowrap">
                  Transkrip Percakapan Real-Time
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
                <span className="bg-slate-200/80 text-slate-700 font-semibold px-2.5 py-0.5 rounded-full text-[11px] whitespace-nowrap shrink-0">
                  {transcript.length} percakapan
                </span>
              </div>
            </div>

            {/* Scrollable Transcript Feed */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 scroll-smooth">
              {transcript.length === 0 ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 space-y-3 my-auto">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#01959f]">
                    <Sparkles className="h-6 w-6 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">Sesi Wawancara Siap Dimulai</p>
                    <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                      Pewawancara AI Rakamin akan menyapa Anda terlebih dahulu. Silakan jawab pertanyaan dengan santai dan jelas melalui mikrofon.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {transcript.map((turn, i) => (
                    <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
                  ))}
                  <div ref={transcriptEndRef} className="h-4" />
                </>
              )}
            </div>

            {/* Panel Footer note */}
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/40 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
              <span>Transkrip auditable (UU PDP & Monozukuri)</span>
              <span className="hidden sm:inline">Auto-scroll aktif</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Floating Control Dock */}
      <div className="mt-4 p-2.5 sm:px-6 sm:py-3 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-lg shadow-slate-100/80 rounded-2xl flex items-center justify-between gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <div
            className={cn(
              "w-2.5 h-2.5 rounded-full shrink-0",
              micMuted ? "bg-rose-500" : "bg-emerald-500 animate-pulse"
            )}
          />
          <span className="text-xs font-semibold text-slate-700 hidden sm:inline whitespace-nowrap">
            {micMuted ? "Mikrofon Senyap" : "Mikrofon Siaga"}
          </span>
        </div>

        {/* Center: Large Tactile Microphone Toggle */}
        <div className="flex-1 sm:flex-initial flex items-center justify-center min-w-0">
          <Button
            onClick={toggleMic}
            className={cn(
              "w-full sm:w-auto rounded-xl px-3 sm:px-5 py-2.5 text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2",
              micMuted
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20"
                : "bg-[#01959f] hover:bg-[#00828b] text-white shadow-[#01959f]/25 hover:scale-102"
            )}
          >
            {micMuted ? (
              <>
                <MicOff className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">Muted (Mic Mati)</span>
              </>
            ) : (
              <>
                <Mic className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">Mic On (Mikrofon Aktif)</span>
              </>
            )}
          </Button>
        </div>

        {/* Right: End Interview Action with Confirmation Modal */}
        <div className="flex items-center gap-2 shrink-0">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-300 text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 rounded-xl px-2.5 sm:px-4 py-2 font-bold text-xs shrink-0"
              >
                <span className="whitespace-nowrap">End Interview</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-lg font-bold text-slate-900">
                  End interview? (Akhiri sesi wawancara?)
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-slate-600">
                  Are you sure you want to end the interview early? Rekaman dan transkrip percakapan akan langsung diproses menjadi laporan portofolio kompetensi.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:gap-0">
                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={endInterview}
                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold"
                >
                  End interview
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {import.meta.env.DEV && (
            <Button
              variant="outline"
              size="sm"
              className="text-[11px] text-slate-400 hover:text-slate-700 rounded-xl px-2.5 hidden md:flex"
              onClick={() => sendJson({ type: "debug_force_reconnect" })}
            >
              ⚡ Reconnect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
