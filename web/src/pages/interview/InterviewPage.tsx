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
import {
  CheckCircle,
  CheckCircle2,
  Mic,
  MicOff,
  Clock,
  Sparkles,
  ShieldCheck,
  Headphones,
  ArrowRight,
} from "lucide-react";
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
    disconnect();
    setInterviewState("complete");
  }, [stopCapture, stopPlayback, sendJson, disconnect]);

  const wsConnectionStatus =
    interviewState === "reconnecting"
      ? connectionLostLong ? "lost" : "reconnecting"
      : connectionState === "connected"
      ? "connected"
      : "reconnecting";

  // ── State A: Pre-start (Split 2-Column Heroic Layout) ───────────────────
  if (interviewState === "idle") {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        {/* Main Grid: Left Briefing + Right Hardware Readiness Console */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ── Left Column: Assessment Briefing & Guidelines (col-span-5 / 12) ── */}
          <div className="lg:col-span-5 space-y-6">
            {/* Role Header & Meta */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>AI Technical Assessment</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
                {candidateInfo?.role_title ?? "Software Engineer"}
              </h1>

              <p className="text-sm text-slate-600 leading-relaxed">
                Wawancara teknis berbasis suara interaktif bersama AI Interviewer. Sistem akan menguji pemahaman konsep, pemecahan masalah, dan kedalaman teknis Anda secara adaptif.
              </p>
            </div>

            {/* Assessment Specs Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-white/85 border border-emerald-200/80 shadow-sm flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-500">Estimasi Durasi</div>
                  <div className="text-sm font-bold text-slate-900">
                    {candidateInfo?.time_limit_min ? `${candidateInfo.time_limit_min} Menit` : "45 Menit"}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/85 border border-emerald-200/80 shadow-sm flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-500">Format Sesi</div>
                  <div className="text-sm font-bold text-slate-900">Voice AI Live</div>
                </div>
              </div>
            </div>

            {/* Candidate Guidelines Card */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white/90 backdrop-blur-xl border border-emerald-500/20 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.08)] space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-b border-emerald-100 pb-3">
                <Headphones className="h-4 w-4 text-emerald-600" />
                <span>Petunjuk Penting Sebelum Memulai</span>
              </div>

              <div className="space-y-3.5 text-xs text-slate-600">
                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold text-[10px] shrink-0 mt-0.5">
                    1
                  </div>
                  <p className="leading-relaxed">
                    <strong className="text-slate-900 font-semibold">Ruangan yang Tenang:</strong> Pastikan Anda berada di lingkungan yang hening. Disarankan menggunakan headset atau earphone untuk kejelasan audio maksimal.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold text-[10px] shrink-0 mt-0.5">
                    2
                  </div>
                  <p className="leading-relaxed">
                    <strong className="text-slate-900 font-semibold">Percakapan Dua Arah:</strong> AI akan merespons jawaban Anda secara langsung dan mengajukan pertanyaan lanjutan tanpa teks skrip hafalan.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold text-[10px] shrink-0 mt-0.5">
                    3
                  </div>
                  <p className="leading-relaxed">
                    <strong className="text-slate-900 font-semibold">Mikrofon Selalu Aktif:</strong> Saat giliran Anda berbicara, sampaikan pemikiran secara lugas. Anda dapat mengakhiri sesi kapan saja bila diperlukan.
                  </p>
                </div>
              </div>
            </div>

            {/* Privacy & Trust Badge */}
            <div className="flex items-center gap-2.5 text-xs text-slate-500 px-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Sesi ini direkam dan dianalisis khusus untuk proses rekrutmen ini secara rahasia.</span>
            </div>
          </div>

          {/* ── Right Column: Hardware Readiness & Diagnostics (col-span-7 / 12) ── */}
          <div className="lg:col-span-7 relative">
            {/* Ambient Backlight Halo around the card */}
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-b from-emerald-400/20 via-teal-300/15 to-transparent blur-2xl opacity-70 pointer-events-none" />

            {!hardwareCheckDone ? (
              <HardwareCheck onStart={() => { setHardwareCheckDone(true); startInterview(); }} />
            ) : (
              <div className="relative rounded-3xl bg-white/95 backdrop-blur-2xl border border-emerald-500/25 p-7 sm:p-8 space-y-6 shadow-[0_20px_50px_-15px_rgba(16,185,129,0.15)] text-center">
                <div className="h-16 w-16 mx-auto rounded-3xl bg-emerald-50 border border-emerald-300 flex items-center justify-center text-emerald-600 shadow-md">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-xl font-bold text-slate-900">Perangkat & Sistem Siap 100%</h2>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto">
                    Seluruh pengujian perangkat telah selesai. Tekan tombol di bawah untuk langsung terhubung dengan AI Interviewer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startInterview}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm flex items-center justify-center gap-2.5 shadow-[0_6px_25px_rgba(16,185,129,0.35)] hover:shadow-[0_8px_35px_rgba(16,185,129,0.5)] active:scale-[0.99] transition-all cursor-pointer border border-emerald-400/40"
                >
                  <Mic className="h-4 w-4" />
                  <span>Mulai Wawancara Sekarang</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── State F: Complete ───────────────────────────────────────────────────
  if (interviewState === "complete") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="relative rounded-3xl bg-white/95 backdrop-blur-2xl border border-emerald-500/25 shadow-[0_20px_60px_-15px_rgba(16,185,129,0.15)] p-8 sm:p-10 space-y-6 overflow-hidden">
          {/* Top Neon Accent */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 absolute top-0 left-0 right-0" />

          {/* Celebratory Icon */}
          <div className="h-20 w-20 mx-auto rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-300 flex items-center justify-center text-emerald-600 shadow-md">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Wawancara Selesai
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              Terima kasih telah meluangkan waktu. Seluruh sesi percakapan Anda telah tersimpan dengan aman dan sedang dianalisis oleh sistem kami.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 text-xs text-emerald-900 text-left space-y-1.5">
            <div className="font-semibold flex items-center gap-2 text-emerald-800">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              Langkah Selanjutnya:
            </div>
            <p className="text-emerald-800/80 leading-relaxed">
              Tim rekrutmen akan meninjau transkrip dan matriks kompetensi keahlian Anda. Informasi hasil seleksi akan dikirimkan melalui email yang terdaftar.
            </p>
          </div>

          <p className="text-xs text-slate-500 pt-2">
            Anda dapat menutup jendela browser ini dengan aman.
          </p>
        </div>
      </div>
    );
  }

  // ── States B/C/D/E: Active interview ────────────────────────────────────
  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col h-full space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between py-3 px-5 border border-emerald-500/20 rounded-2xl bg-white/90 backdrop-blur-xl shadow-sm sticky top-20 z-20">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-semibold text-slate-900">{candidateInfo?.role_title ?? "AI Interview"}</span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 border border-emerald-300 text-emerald-800">
            Live Voice
          </span>
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
          <div className="flex items-center gap-2.5 text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
            <span>Koneksi terputus cukup lama. Mohon tetap di halaman ini, sistem sedang berusaha menghubungkan kembali.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
            <span>Sedang menghubungkan kembali audio stream — mohon tunggu sebentar.</span>
          </div>
        )
      )}

      {/* Reconnected prompt */}
      {reconnectedPrompt && (
        <div className="flex items-center justify-between text-xs bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl p-4 shadow-sm">
          <span>Koneksi kembali pulih — silakan ucapkan <strong>"check"</strong> atau lanjutkan jawaban Anda.</span>
          <button className="ml-3 text-emerald-700 hover:text-emerald-900 font-bold shrink-0" onClick={() => setReconnectedPrompt(false)}>✕</button>
        </div>
      )}

      {/* Voice indicator console card */}
      <div className="flex-1 min-h-[380px] rounded-3xl bg-white/90 backdrop-blur-2xl border border-emerald-500/20 shadow-[0_20px_50px_-15px_rgba(16,185,129,0.12)] flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Ambient emerald backlight behind voice bars */}
        <div className="absolute w-72 h-72 rounded-full bg-emerald-400/15 blur-3xl pointer-events-none" />

        {interviewState === "connecting" ? (
          <div className="flex flex-col items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            <div className="text-sm font-medium text-slate-600 animate-pulse">Menghubungkan ke AI Interviewer...</div>
          </div>
        ) : interviewState === "draining_audio" ? (
          <div className="flex flex-col items-center gap-3 text-center relative z-10">
            <VoiceBars active={true} label="AI sedang menyelesaikan bicara" variant="ai" />
            <p className="text-xs text-slate-500">Menyelesaikan perekaman sesi...</p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-6 relative z-10">
            <div className="p-6 rounded-3xl bg-emerald-50/50 border border-emerald-200/80 flex flex-col items-center gap-4 shadow-sm">
              <VoiceBars
                active={aiSpeaking}
                label={aiSpeaking ? "AI sedang berbicara..." : "AI mendengarkan..."}
                variant="ai"
              />

              {candidateSpeaking && (
                <div className="pt-2 border-t border-emerald-200/60 w-full flex justify-center">
                  <VoiceBars
                    active={true}
                    label="Anda sedang berbicara"
                    variant="candidate"
                  />
                </div>
              )}
            </div>

            {/* Transcript container */}
            {transcript.length > 0 && (
              <div className="w-full space-y-2.5 overflow-y-auto max-h-[40vh] p-2">
                {transcript.map((turn, i) => (
                  <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom control bar */}
      <div className="border border-emerald-500/20 py-3.5 px-5 rounded-2xl bg-white/90 backdrop-blur-xl shadow-sm flex items-center justify-between gap-4 sticky bottom-4 z-20">
        <ConnectionStatus state={wsConnectionStatus} />

        <div className="flex items-center gap-3">
          <Button
            variant={micMuted ? "destructive" : "outline"}
            size="sm"
            onClick={toggleMic}
            className={`rounded-xl font-medium text-xs border ${
              micMuted
                ? "bg-rose-500 text-white hover:bg-rose-600"
                : "border-emerald-300 text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100"
            }`}
          >
            {micMuted ? (
              <><MicOff className="h-3.5 w-3.5 mr-1.5" /> Muted</>
            ) : (
              <><Mic className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> Mic Aktif</>
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:text-rose-600 hover:border-rose-300 transition-colors cursor-pointer shadow-sm"
              >
                Akhiri Wawancara
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl border-emerald-500/20">
              <AlertDialogHeader>
                <AlertDialogTitle>Akhiri sesi wawancara?</AlertDialogTitle>
                <AlertDialogDescription>
                  Apakah Anda yakin ingin menyelesaikan wawancara lebih awal? Jawaban yang telah terekam akan disimpan dan dianalisis.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={endInterview}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
                >
                  Ya, Akhiri
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

    </div>
  );
}
