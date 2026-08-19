import HardwareCheck from "@/components/HardwareCheck";
import ConnectionStatus from "@/components/interview/ConnectionStatus";
import InterviewTimer from "@/components/interview/InterviewTimer";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
import VoiceBars from "@/components/interview/VoiceBars";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { api } from "@/services/api";
import { sessionsApi } from "@/services/sessions";
import type { CandidateInfo, InterviewSpeaker, InterviewState, TranscriptTurn } from "@/types";
import { CheckCircle, Mic, MicOff, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

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

  // Consent states
  const [consented, setConsented] = useState(false);
  const [submittingConsent, setSubmittingConsent] = useState(false);

  const handleConsentAndStart = async () => {
    if (!consented) return;
    setSubmittingConsent(true);
    try {
      if (token) {
        await api.post(`/sessions/${token}/consent`);
      }
      await startInterview();
    } catch (error) {
      console.error("Failed to record consent:", error);
    } finally {
      setSubmittingConsent(false);
    }
  };

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
    [scheduleAfterPlayback],
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

  const {
    start: startCapture,
    stop: stopCapture,
    mute,
    unmute,
  } = useAudioCapture({
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

  const wsConnectionStatus = interviewState === "reconnecting" ? (connectionLostLong ? "lost" : "reconnecting") : connectionState === "connected" ? "connected" : "reconnecting";

  // ── State A: Pre-start ──────────────────────────────────────────────────
  if (interviewState === "idle") {
    return (
      <div className="max-w-xl px-4 py-8 mx-auto space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">{candidateInfo?.role_title ?? "AI Interview"}</h1>
          {candidateInfo && <p className="text-sm text-muted-foreground">{candidateInfo.time_limit_min} minutes</p>}
        </div>

        {!hardwareCheckDone ? (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1.5 text-muted-foreground">
              <p>• Sesi ini merupakan wawancara suara berbasis AI.</p>
              <p>• AI akan mengajukan pertanyaan lanjutan secara otomatis berdasarkan jawaban Anda.</p>
              <p>• Sesi akan berlangsung hingga {candidateInfo?.time_limit_min ?? "—"} menit.</p>
              <p>• Mikrofon Anda akan aktif selama wawancara berlangsung.</p>
            </div>
            <HardwareCheck
              onStart={() => {
                setHardwareCheckDone(true);
              }}
            />
          </div>
        ) : (
          <div className="p-5 space-y-5 border shadow-sm rounded-xl bg-card">
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Pemeriksaan perangkat keras berhasil. Anda siap memulai.</span>
            </div>

            {/* Explicit Consent Section (Pakai native checkbox) */}
            <div className="pt-2 space-y-3 border-t">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="text-sm font-medium text-foreground">Persetujuan Perekaman & Evaluasi AI</p>
                  <p>Sesuai dengan UU Perlindungan Data Pribadi (UU PDP), kami memerlukan persetujuan eksplisit Anda sebelum sesi dimulai.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/40">
                <input
                  type="checkbox"
                  id="privacy-consent"
                  checked={consented}
                  onChange={(e) => setConsented(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                />
                <label htmlFor="privacy-consent" className="text-xs leading-relaxed cursor-pointer select-none text-muted-foreground">
                  Saya menyetujui perekaman suara, pemrosesan audio oleh model AI, analisis transkrip, serta penyimpanan portofolio hasil wawancara ini untuk keperluan rekrutmen. Saya telah membaca dan memahami{" "}
                  <Link to="/privacy-policy" target="_blank" className="font-medium underline text-primary hover:text-primary/80">
                    Kebijakan Privasi & Retensi Data
                  </Link>
                  .
                </label>
              </div>
            </div>

            <Button className="w-full" size="lg" disabled={!consented || submittingConsent} onClick={handleConsentAndStart}>
              <Mic className="w-4 h-4 mr-2" />
              {submittingConsent ? "Menyiapkan Sesi..." : "Start Interview"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── State F: Complete ───────────────────────────────────────────────────
  if (interviewState === "complete") {
    return (
      <div className="max-w-xl px-4 py-16 mx-auto space-y-4 text-center">
        <div className="text-4xl">✅</div>
        <h2 className="text-xl font-semibold">Interview Complete</h2>
        <p className="text-sm text-muted-foreground">
          Terima kasih. Wawancara Anda telah selesai direkam dan diproses.
          <br />
          Tim rekrutmen akan meninjau hasil Anda dan memberikan pembaruan lebih lanjut.
        </p>
      </div>
    );
  }

  // ── States B/C/D/E: Active interview ────────────────────────────────────
  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";

  return (
    <div className="flex flex-col h-full max-w-xl px-4 mx-auto">
      {/* Top bar */}
      <div className="sticky z-10 flex items-center justify-between py-3 bg-white border-b top-12">
        <span className="text-sm font-medium">AI Interview</span>
        {candidateInfo && <InterviewTimer totalSeconds={candidateInfo.time_limit_min * 60} running={interviewState === "active"} onExpired={endInterview} />}
      </div>

      {/* Reconnecting banner */}
      {interviewState === "reconnecting" &&
        (connectionLostLong ? (
          <div className="flex items-center gap-2 text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-2.5 mt-2">
            <span className="animate-pulse">●</span>
            <span>Koneksi terputus terlalu lama. Mohon tunggu, atau hubungi rekruter jika kendala berlanjut.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-2.5 mt-2">
            <span className="animate-pulse">●</span>
            <span>Menghubungkan ulang... mohon tunggu sebentar.</span>
          </div>
        ))}

      {/* Reconnected prompt */}
      {reconnectedPrompt && (
        <div className="flex items-center justify-between text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-2.5 mt-2">
          <span>
            Terhubung kembali — silakan katakan <strong>"tes"</strong> atau lanjutkan jawaban Anda.
          </span>
          <button className="ml-3 text-blue-500 hover:text-blue-700 shrink-0" onClick={() => setReconnectedPrompt(false)}>
            ✕
          </button>
        </div>
      )}

      {/* Voice indicator */}
      <div className="flex flex-col items-center justify-center flex-1 gap-6 py-8">
        {interviewState === "connecting" ? (
          <div className="text-sm text-muted-foreground animate-pulse">Connecting...</div>
        ) : interviewState === "draining_audio" ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <VoiceBars active={true} label="AI speaking" variant="ai" />
            <p className="text-xs text-muted-foreground">Mengakhiri sesi...</p>
          </div>
        ) : (
          <>
            <VoiceBars active={aiSpeaking} label={aiSpeaking ? "AI speaking" : "Mendengarkan..."} variant="ai" />

            {candidateSpeaking && <VoiceBars active={true} label="Anda sedang berbicara" variant="candidate" />}

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
      <div className="sticky bottom-0 flex items-center justify-between gap-4 py-3 bg-white border-t">
        <ConnectionStatus state={wsConnectionStatus} />

        <div className="flex items-center gap-3">
          <Button variant={micMuted ? "destructive" : "outline"} size="sm" onClick={toggleMic}>
            {micMuted ? (
              <>
                <MicOff className="h-3.5 w-3.5 mr-1.5" /> Muted
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5 mr-1.5" /> Mic On
              </>
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                Akhiri Sesi
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Akhiri wawancara?</AlertDialogTitle>
                <AlertDialogDescription>Apakah Anda yakin ingin mengakhiri sesi wawancara lebih awal?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={endInterview}>Ya, Akhiri</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
