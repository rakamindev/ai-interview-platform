import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Mic,
  MicOff,
  AlertTriangle,
  WifiOff,
  RefreshCw,
  ShieldCheck,
  Clock,
  Lock,
} from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

export type PageStatus =
  | "loading"
  | "invalid_token"
  | "network_error"
  | "session_expired"
  | "consent_pending"
  | "hardware_check"
  | "ready"
  | "in_interview"
  | "complete";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false);
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [isSubmittingConsent, setIsSubmittingConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);

  // Load candidate session with explicit status resolution
  const loadCandidateSession = useCallback(async () => {
    if (!token) {
      setPageStatus("invalid_token");
      return;
    }

    try {
      setIsRetrying(true);
      const res = await sessionsApi.getCandidateInfo(token);
      setCandidateInfo(res.data);
      setSessionId(res.data.session_id);

      if (res.data.session_status === "ended") {
        setPageStatus("complete");
      } else if (res.data.session_status === "failed") {
        setPageStatus("session_expired");
      } else if (res.data.has_consented) {
        setPageStatus("hardware_check");
      } else {
        setPageStatus("consent_pending");
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setPageStatus("invalid_token");
      } else {
        setPageStatus("network_error");
      }
    } finally {
      setIsRetrying(false);
    }
  }, [token]);

  useEffect(() => {
    loadCandidateSession();
  }, [loadCandidateSession]);

  const handleConsentSubmit = useCallback(async () => {
    if (!token || !consentAgreed) return;

    try {
      setIsSubmittingConsent(true);
      setConsentError(null);
      await sessionsApi.recordConsent(token, "v1.0-2026");
      setPageStatus("hardware_check");
    } catch {
      setConsentError("Gagal mencatat persetujuan. Silakan periksa koneksi Anda dan coba lagi.");
    } finally {
      setIsSubmittingConsent(false);
    }
  }, [token, consentAgreed]);

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
    setPageStatus("in_interview");
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
    setPageStatus("complete");
  }, [stopCapture, stopPlayback, sendJson, disconnect]);

  const wsConnectionStatus =
    interviewState === "reconnecting"
      ? connectionLostLong ? "lost" : "reconnecting"
      : connectionState === "connected"
      ? "connected"
      : "reconnecting";

  // ── Render State 1: Loading ─────────────────────────────────────────────
  if (pageStatus === "loading") {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
        <h2 className="text-lg font-medium text-foreground">Memuat sesi wawancara...</h2>
        <p className="text-sm text-muted-foreground">Menghubungkan ke platform evaluasi AI.</p>
      </div>
    );
  }

  // ── Render State 2: Invalid Token (GAP-02) ──────────────────────────────
  if (pageStatus === "invalid_token") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <Card className="border-destructive/30 shadow-sm">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-3">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl text-destructive font-semibold">
              Link Wawancara Tidak Ditemukan
            </CardTitle>
            <CardDescription className="text-sm pt-1">
              Tautan wawancara yang Anda gunakan tidak valid, salah ketik, atau telah dihapus oleh tim perekrut.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2 text-sm text-muted-foreground text-center">
            <div className="bg-muted/40 rounded-lg p-3 text-xs text-left space-y-1">
              <p className="font-medium text-foreground">• Periksa kembali link undangan:</p>
              <p>Pastikan Anda membuka URL lengkap persis seperti yang dikirimkan melalui email/pesan.</p>
              <p className="font-medium text-foreground pt-1">• Butuh bantuan?</p>
              <p>Hubungi rekruter atau institusi pengundang Anda untuk menerbitkan link sesi yang baru.</p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Muat Ulang Halaman
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render State 3: Network Error (GAP-02 with Retry) ───────────────────
  if (pageStatus === "network_error") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <Card className="border-amber-300 shadow-sm">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mb-3 border border-amber-200">
              <WifiOff className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl text-foreground font-semibold">
              Gagal Terhubung ke Server
            </CardTitle>
            <CardDescription className="text-sm pt-1">
              Terjadi gangguan koneksi jaringan saat memuat data sesi wawancara.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2 text-sm text-center">
            <p className="text-muted-foreground text-xs">
              Silakan periksa koneksi internet Anda. Sesi Anda tetap aman dan dapat dilanjutkan segera setelah koneksi pulih.
            </p>
            <Button
              className="w-full"
              onClick={loadCandidateSession}
              disabled={isRetrying}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? "animate-spin" : ""}`} />
              {isRetrying ? "Mencoba Menghubungkan..." : "Coba Lagi"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render State 4: Session Expired ────────────────────────────────────
  if (pageStatus === "session_expired") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <Card className="border-muted shadow-sm">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
              <Clock className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-semibold">
              Sesi Wawancara Telah Berakhir
            </CardTitle>
            <CardDescription className="text-sm pt-1">
              Sesi wawancara ini sudah ditutup atau telah melewati batas waktu yang ditentukan.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground text-center">
            <p>Jika Anda merasa ini adalah kekeliruan, silakan hubungi tim rekrutmen Anda.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render State 5: Privacy Notice & Informed Consent (UU PDP GAP-03) ──
  if (pageStatus === "consent_pending") {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">{candidateInfo?.role_title ?? "AI Interview"}</h1>
          {candidateInfo && (
            <p className="text-sm text-muted-foreground">
              Batas Waktu: {candidateInfo.time_limit_min} Menit
            </p>
          )}
        </div>

        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center gap-2 text-primary font-medium text-sm">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <span>Persetujuan Pemrosesan Data Pribadi (UU PDP No. 27/2022)</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs leading-relaxed text-muted-foreground">
            <p>
              Sebelum memulai sesi wawancara, mohon membaca dan menyetujui ketentuan pemrosesan data pribadi berikut:
            </p>

            <div className="bg-muted/40 rounded-lg p-3 space-y-2 border text-foreground/90">
              <div className="flex items-start gap-2">
                <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Tujuan Pemrosesan:</span> Suara Anda akan direkam dan diproses secara real-time untuk mengevaluasi kompetensi teknis posisi ini berdasarkan rubrik taksonomi keahlian.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mic className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Pemroses Pihak Ketiga:</span> Transmisi streaming audio diproses dengan model kecerdasan buatan (AI) Google Gemini melalui server platform terenkripsi.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Hak Subjek Data:</span> Rekaman dan transkrip digunakan khusus untuk keperluan rekrutmen ini. Anda berhak mengakhiri sesi kapan saja.
                </div>
              </div>
            </div>

            {consentError && (
              <div className="p-2.5 rounded bg-destructive/10 text-destructive text-xs">
                {consentError}
              </div>
            )}

            <label className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 cursor-pointer transition-colors">
              <input
                type="checkbox"
                aria-label="persetujuan-suara-ai"
                checked={consentAgreed}
                onChange={(e) => setConsentAgreed(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary mt-0.5"
              />
              <span className="text-xs text-foreground font-medium">
                Saya memahami dan menyetujui perekaman suara biometrik serta analisis kompetensi oleh AI untuk keperluan seleksi kerja ini.
              </span>
            </label>

            <Button
              className="w-full"
              size="lg"
              disabled={!consentAgreed || isSubmittingConsent}
              onClick={handleConsentSubmit}
            >
              {isSubmittingConsent ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Mencatat Persetujuan...
                </>
              ) : (
                "Lanjutkan ke Pemeriksaan Perangkat"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render State 6: Hardware Check & Ready State ────────────────────────
  if (pageStatus === "hardware_check" || pageStatus === "ready") {
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

        {!hardwareCheckDone ? (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1.5 text-muted-foreground">
              <p>• This is a voice interview. Make sure you're in a quiet place.</p>
              <p>• The AI will ask follow-up questions — there are no scripts.</p>
              <p>• The session will last up to {candidateInfo?.time_limit_min ?? "—"} minutes.</p>
              <p>• Your mic will be active throughout. You can end anytime.</p>
            </div>
            <HardwareCheck
              onStart={() => {
                setHardwareCheckDone(true);
                setPageStatus("ready");
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
            <Button className="w-full" size="lg" onClick={startInterview}>
              <Mic className="h-4 w-4 mr-2" />
              Start Interview
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Render State 7: Genuine Complete (Only when ended from DB) ──────────
  if (pageStatus === "complete") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="text-4xl">✅</div>
        <h2 className="text-xl font-semibold">Interview Complete</h2>
        <p className="text-sm text-muted-foreground">
          Thank you. The interview has been recorded.
          <br />
          The hiring team will review your results and follow up with you.
        </p>
      </div>
    );
  }

  // ── Render State 8: Active Interview Session ───────────────────────────
  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";

  return (
    <div className="max-w-xl mx-auto px-4 flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between py-3 border-b sticky top-12 bg-white z-10">
        <span className="text-sm font-medium">AI Interview</span>
        {candidateInfo && (
          <InterviewTimer
            totalSeconds={candidateInfo.time_limit_min * 60}
            running={interviewState === "active"}
            onExpired={endInterview}
          />
        )}
      </div>

      {/* Reconnected prompt banner */}
      {reconnectedPrompt && (
        <div className="py-2 px-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 text-center animate-fade-in mt-2">
          Koneksi tersambung kembali. Anda dapat melanjutkan jawaban Anda.
        </div>
      )}

      {/* Connection status banner (non-blocking) */}
      <div className="py-1">
        <ConnectionStatus state={wsConnectionStatus} />
      </div>

      {/* Main interaction area */}
      <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-6">
        <VoiceBars
          active={interviewState === "active" && speaker !== null}
          label={aiSpeaking ? "AI is speaking" : candidateSpeaking ? "Listening to you" : "Listening..."}
          variant={aiSpeaking ? "ai" : "candidate"}
        />

        <div className="text-center text-xs text-muted-foreground h-4">
          {interviewState === "connecting" && "Connecting to AI interviewer..."}
          {interviewState === "active" && aiSpeaking && "AI is speaking..."}
          {interviewState === "active" && candidateSpeaking && "Listening to you..."}
          {interviewState === "active" && !aiSpeaking && !candidateSpeaking && "Listening..."}
          {interviewState === "reconnecting" && "Reconnecting..."}
          {interviewState === "draining_audio" && "Wrapping up..."}
          {interviewState === "ending" && "Finishing..."}
        </div>

        {/* Live transcript bubble */}
        <div className="w-full max-w-sm min-h-[56px] flex items-center justify-center">
          {transcript.length > 0 ? (
            <TranscriptBubble
              speaker={transcript[transcript.length - 1].speaker}
              text={transcript[transcript.length - 1].text}
            />
          ) : (
            <p className="text-xs text-muted-foreground/60 italic text-center">
              The conversation will appear here once it starts.
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="py-4 border-t flex items-center justify-center gap-4 bg-white sticky bottom-0">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleMic}
          disabled={interviewState !== "active"}
          aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {micMuted ? <MicOff className="h-4 w-4 text-destructive" /> : <Mic className="h-4 w-4" />}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={interviewState !== "active"}
            >
              End Interview
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>End interview early?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to end the interview? Your answers so far will be evaluated by the hiring team.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Continue Interview</AlertDialogCancel>
              <AlertDialogAction onClick={endInterview}>
                Yes, End Interview
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
