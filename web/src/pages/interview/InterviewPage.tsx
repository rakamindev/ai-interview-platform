import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AudioWaveformVisualizer from "@/components/interview/AudioWaveformVisualizer";
import AIThoughtIndicator, { AIInteractionStatus } from "@/components/interview/AIThoughtIndicator";
import EndSessionModal from "@/components/interview/EndSessionModal";
import InterviewTimer from "@/components/interview/InterviewTimer";
import ConnectionStatus from "@/components/interview/ConnectionStatus";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { sessionsApi } from "@/services/sessions";
import HardwareCheck from "@/components/HardwareCheck";
import { CheckCircle2, Mic, MicOff, Shield, Radio, Sparkles, AlertCircle } from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

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
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  
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
    setIsEndingSession(true);
    try {
      setInterviewState("ending");
      if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
      stopCapture();
      stopPlayback();
      sendJson({ type: "end_session" });
      disconnect();
      setInterviewState("complete");
    } finally {
      setIsEndingSession(false);
      setEndModalOpen(false);
    }
  }, [stopCapture, stopPlayback, sendJson, disconnect]);

  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate" && !micMuted;

  const aiInteractionStatus: AIInteractionStatus = useMemo(() => {
    if (interviewState === "reconnecting" || interviewState === "draining_audio") return "thinking";
    if (aiSpeaking) return "speaking";
    if (candidateSpeaking) return "listening";
    return "idle";
  }, [interviewState, aiSpeaking, candidateSpeaking]);

  const wsConnectionStatus =
    interviewState === "reconnecting"
      ? connectionLostLong ? "lost" : "reconnecting"
      : connectionState === "connected"
      ? "connected"
      : "lost";

  // ── State A: Idle (Pre-flight Hardware Check) ──────────────────────────
  if (interviewState === "idle") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <Sparkles className="w-3.5 h-3.5" />
            Asesmen Kompetensi Berbasis AI
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {candidateInfo?.role_title ?? "Sesi Wawancara AI"}
          </h1>
          {candidateInfo && (
            <p className="text-muted-foreground text-xs sm:text-sm max-w-md mx-auto">
              Estimasi durasi wawancara maksimum: <strong className="text-foreground">{candidateInfo.time_limit_min} Menit</strong>
            </p>
          )}
        </div>

        {!hardwareCheckDone ? (
          <div className="space-y-6 bg-card border border-border/80 rounded-3xl p-6 shadow-sm">
            <div className="bg-muted/40 rounded-2xl p-4 text-xs space-y-2 text-foreground/90 border border-border/60">
              <p className="font-semibold text-foreground">Panduan Sebelum Memulai:</p>
              <p>• Pastikan Anda berada di ruangan yang tenang dan menggunakan headset/mikrofon berkualitas baik.</p>
              <p>• Asisten AI akan mengajukan pertanyaan teknis dan mendalam sesuai standar kompetensi posisi.</p>
              <p>• Data wawancara dan transkrip Anda dilindungi penuh di bawah UU Perlindungan Data Pribadi (UU PDP No. 27/2022).</p>
            </div>
            <HardwareCheck onStart={() => { setHardwareCheckDone(true); startInterview(); }} />
          </div>
        ) : (
          <div className="space-y-4 bg-card border border-border/80 rounded-3xl p-8 shadow-sm text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 font-semibold">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <span>Semua pemeriksaan mikrofon & audio berhasil. Anda siap memulai!</span>
            </div>
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 rounded-2xl shadow-md text-base transition-all active:scale-[0.99]"
              size="lg"
              onClick={startInterview}
            >
              <Mic className="h-5 w-5 mr-2" />
              Mulai Sesi Wawancara Sekarang
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── State F: Complete ───────────────────────────────────────────────────
  if (interviewState === "complete") {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto shadow-xl">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Wawancara Selesai</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Terima kasih telah meluangkan waktu. Seluruh tanggapan Anda telah direkam dan disimpan secara aman. Tim rekrutmen & sistem asesmen akan segera meninjau portofolio hasil evaluasi Anda.
          </p>
        </div>
        <div className="pt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="w-4 h-4 text-primary" />
          <span>Tersimpan dengan enkripsi & mematuhi standar UU PDP</span>
        </div>
      </div>
    );
  }

  // ── States B/C/D/E: Active interview HUD ─────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 flex flex-col h-[calc(100vh-5rem)] justify-between py-4">
      {/* Top HUD Bar */}
      <div className="flex items-center justify-between py-3 px-5 bg-card/90 backdrop-blur-xl border border-border/80 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">{candidateInfo?.role_title ?? "AI Interview"}</h2>
            <p className="text-[11px] text-muted-foreground">Live Voice Stream</p>
          </div>
        </div>

        {candidateInfo && (
          <div className="px-3.5 py-1.5 rounded-full bg-muted/60 border border-border/60 shadow-inner">
            <InterviewTimer
              totalSeconds={candidateInfo.time_limit_min * 60}
              running={interviewState === "active"}
              onExpired={endInterview}
            />
          </div>
        )}
      </div>

      {/* Warnings & Banners */}
      {interviewState === "reconnecting" && (
        <div className={`flex items-center gap-2.5 text-xs rounded-xl px-4 py-3 mt-2 border ${
          connectionLostLong 
            ? "bg-destructive/10 border-destructive/30 text-destructive"
            : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-300"
        }`}>
          <span className="animate-pulse">●</span>
          <span>
            {connectionLostLong
              ? "Koneksi membutuhkan waktu pemulihan lebih lama. Mohon tunggu sejenak..."
              : "Menghubungkan kembali koneksi audio..."}
          </span>
        </div>
      )}

      {reconnectedPrompt && (
        <div className="flex items-center justify-between text-xs bg-primary/10 border border-primary/30 text-primary rounded-xl px-4 py-2.5 mt-2">
          <span>Koneksi kembali stabil. Silakan lanjutkan jawaban Anda.</span>
          <button className="text-primary hover:opacity-75" onClick={() => setReconnectedPrompt(false)}>✕</button>
        </div>
      )}

      {/* Main Interactive Stage */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 py-6">
        <AIThoughtIndicator status={aiInteractionStatus} />

        <div className="w-full max-w-lg">
          <AudioWaveformVisualizer
            isActive={interviewState === "active"}
            isAiSpeaking={aiSpeaking}
            audioLevel={aiSpeaking || candidateSpeaking ? 0.8 : 0.2}
          />
        </div>

        {/* Live Transcript Bubble Area */}
        {transcript.length > 0 && (
          <div className="w-full max-w-xl space-y-3 overflow-y-auto max-h-[35vh] px-2">
            {transcript.map((turn, i) => (
              <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="py-3 px-5 bg-card/90 backdrop-blur-xl border border-border/80 rounded-2xl shadow-sm flex items-center justify-between gap-4">
        <ConnectionStatus state={wsConnectionStatus} />

        <div className="flex items-center gap-3">
          <Button
            variant={micMuted ? "destructive" : "outline"}
            size="sm"
            onClick={toggleMic}
            className={`rounded-xl text-xs font-semibold transition-all ${
              micMuted 
                ? "bg-destructive text-destructive-foreground shadow-md" 
                : "border-border bg-muted/40 text-foreground hover:bg-muted"
            }`}
          >
            {micMuted ? (
              <><MicOff className="h-3.5 w-3.5 mr-1.5" /> Mic Nonaktif</>
            ) : (
              <><Mic className="h-3.5 w-3.5 mr-1.5 text-primary" /> Mic Aktif</>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setEndModalOpen(true)}
            className="border-border bg-muted/40 text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 rounded-xl text-xs font-semibold"
          >
            Akhiri Wawancara
          </Button>
        </div>
      </div>

      <EndSessionModal
        open={endModalOpen}
        onOpenChange={setEndModalOpen}
        onConfirm={endInterview}
        isSubmitting={isEndingSession}
      />
    </div>
  );
}
