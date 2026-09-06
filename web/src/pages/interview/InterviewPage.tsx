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
import { AlertTriangle, CheckCircle, Mic, MicOff, WifiOff } from "lucide-react";
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
  /**
   * Cacat #7. Alasan kegagalan disimpan supaya layar error bisa menyebutkannya.
   * Backend sudah mengirim pesan yang enak dibaca manusia
   * (`sessions_controller.rb:132-154` → "Invalid or expired invite token",
   * "Assessment not found"), lalu `.catch(() => setInterviewState("complete"))`
   * membuangnya dan menggantinya dengan ucapan terima kasih. Menyimpannya di
   * state adalah setengah dari perbaikan; separuh lainnya adalah punya layar
   * yang mau menampilkannya.
   */
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Fetch candidate info.
   *
   * Diangkat ke `useCallback` bukan demi rapi, tapi karena perbaikan cacat #7
   * butuh tombol "Try again": kalau API-nya yang mati sebentar, kandidat harus
   * bisa mencoba lagi tanpa menebak-nebak URL undangannya. Fungsi yang hanya
   * hidup di dalam `useEffect` tidak bisa dipanggil ulang oleh tombol.
   */
  const fetchCandidateInfo = useCallback(() => {
    if (!token) return;
    setErrorMessage(null);
    sessionsApi
      .getCandidateInfo(token)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        /**
         * `prev === "error" ? "idle"` — bukan `setInterviewState("idle")` tanpa
         * syarat. Tombol coba lagi harus bisa memulihkan layar, tapi fetch yang
         * resolve terlambat tidak boleh menarik wawancara yang sudah berjalan
         * kembali ke layar pembuka.
         */
        setInterviewState((prev) =>
          res.data.session_status === "ended" ? "complete" : prev === "error" ? "idle" : prev
        );
      })
      .catch((e) => {
        // Idiom yang sudah dipakai di repo ini (VacancyNewPage.tsx:46,
        // AssessmentEditPage.tsx:84, AssessmentNewPage.tsx:103) — bukan pola
        // baru yang bersaing dengan yang sudah ada.
        setErrorMessage(
          e?.response?.data?.errors?.[0]?.message ??
            "We could not load your interview. Please check your connection and try again."
        );
        setInterviewState("error");
      });
  }, [token]);

  useEffect(() => {
    fetchCandidateInfo();
  }, [fetchCandidateInfo]);

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  const { playChunk, stop: stopPlayback, waitForDrain, cancelDrain } = useAudioPlayback();
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
    } else if (state === "connection_lost") {
      // Mic dimatikan: tidak ada gunanya merekam ke socket yang sudah tutup,
      // dan lampu mic yang tetap menyala adalah kebohongan kecil versi lain.
      muteRef.current?.();
      if (connectionLostTimerRef.current) {
        clearTimeout(connectionLostTimerRef.current);
        connectionLostTimerRef.current = null;
      }
    } else {
      if (connectionLostTimerRef.current) {
        clearTimeout(connectionLostTimerRef.current);
        connectionLostTimerRef.current = null;
      }
      setConnectionLostLong(false);
      if (state === "active" && !micMutedRef.current) unmuteRef.current?.();
    }
  }, [callAudioComplete, waitForDrain]);

  const handleReconnected = useCallback(() => {
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    setReconnectedPrompt(true);
    reconnectedPromptTimerRef.current = setTimeout(() => setReconnectedPrompt(false), 10_000);
  }, []);

  const handleTranscript = useCallback((turn: Pick<TranscriptTurn, "speaker" | "text">) => {
    setTranscript((prev) => [...prev.slice(-9), turn]); // keep last 10
  }, []);

  const handleSpeakerChange = useCallback((s: InterviewSpeaker) => {
    setSpeaker(s);
  }, []);

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

  // ── State A: Pre-start ──────────────────────────────────────────────────
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

        {!hardwareCheckDone ? (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1.5 text-muted-foreground">
              <p>• This is a voice interview. Make sure you're in a quiet place.</p>
              <p>• The AI will ask follow-up questions — there are no scripts.</p>
              <p>• The session will last up to {candidateInfo?.time_limit_min ?? "—"} minutes.</p>
              <p>• Your mic will be active throughout. You can end anytime.</p>
            </div>
            <HardwareCheck onStart={() => { setHardwareCheckDone(true); startInterview(); }} />
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

  // ── State G: Error — wawancara tidak pernah bisa dimulai ────────────────
  /**
   * Cacat #7. Layar ini adalah alasan `.catch(() => setInterviewState("complete"))`
   * dulu terasa masuk akal: tidak ada tempat lain untuk mendarat. Sekarang ada.
   *
   * `role="alert"` bukan hiasan — pembaca layar mengumumkannya tanpa perlu
   * fokus berpindah, dan kandidat yang tidak melihat layar tetap tahu
   * wawancaranya belum dimulai.
   */
  if (interviewState === "error") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="flex justify-center">
          <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold">We could not start your interview</h2>
        <p role="alert" className="text-sm text-muted-foreground">
          {errorMessage ??
            "We could not load your interview. Please check your connection and try again."}
        </p>
        <div className="space-y-2">
          <Button className="w-full" size="lg" onClick={fetchCandidateInfo}>
            Try again
          </Button>
          <p className="text-xs text-muted-foreground">
            Your interview has not been recorded. If this keeps happening, contact the hiring
            team for a new invite link.
          </p>
        </div>
      </div>
    );
  }

  // ── State H: Connection lost — wawancara berjalan, sambungan habis ──────
  /**
   * Dipisah dari State G karena pemulihannya berbeda. Di sini wawancara sudah
   * berjalan dan transkripnya sudah ada di server, jadi kalimatnya harus
   * menyebut itu: jawaban yang sudah diberikan tidak hilang. Tombolnya
   * menyambung ulang (`startInterview`), bukan memuat ulang halaman.
   */
  if (interviewState === "connection_lost") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="flex justify-center">
          <WifiOff className="h-10 w-10 text-destructive" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold">Connection lost</h2>
        <p role="alert" className="text-sm text-muted-foreground">
          Your connection dropped and we could not reconnect. Your answers so far have been
          saved — this interview is not complete yet.
        </p>
        <div className="space-y-2">
          <Button className="w-full" size="lg" onClick={startInterview}>
            Reconnect
          </Button>
          <p className="text-xs text-muted-foreground">
            Check your internet connection, then reconnect to continue where you left off.
          </p>
        </div>
      </div>
    );
  }

  // ── State F: Complete ───────────────────────────────────────────────────
  if (interviewState === "complete") {
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

  // ── States B/C/D/E: Active interview ────────────────────────────────────
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

      {/* Reconnecting banner */}
      {interviewState === "reconnecting" && (
        connectionLostLong ? (
          <div className="flex items-center gap-2 text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-2.5 mt-2">
            <span className="animate-pulse">●</span>
            <span>Connection is taking too long to restore. Please wait, and contact the interviewer if this persists.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-2.5 mt-2">
            <span className="animate-pulse">●</span>
            <span>Briefly reconnecting — please wait a moment.</span>
          </div>
        )
      )}

      {/* Reconnected prompt */}
      {reconnectedPrompt && (
        <div className="flex items-center justify-between text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-2.5 mt-2">
          <span>Reconnected — please say <strong>"check"</strong> or continue your answer to resume.</span>
          <button className="ml-3 text-blue-500 hover:text-blue-700 shrink-0" onClick={() => setReconnectedPrompt(false)}>✕</button>
        </div>
      )}

      {/* Voice indicator */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
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
      <div className="border-t py-3 flex items-center justify-between gap-4 sticky bottom-0 bg-white">
        <ConnectionStatus state={wsConnectionStatus} />

        <div className="flex items-center gap-3">
          <Button
            variant={micMuted ? "destructive" : "outline"}
            size="sm"
            onClick={toggleMic}
          >
            {micMuted ? (
              <><MicOff className="h-3.5 w-3.5 mr-1.5" /> Muted</>
            ) : (
              <><Mic className="h-3.5 w-3.5 mr-1.5" /> Mic On</>
            )}
          </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">End Interview</Button>
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
        {import.meta.env.DEV && (
          <Button variant="outline" size="sm" className="text-xs opacity-50"
            onClick={() => sendJson({ type: "debug_force_reconnect" })}>
            ⚡ Force reconnect
          </Button>
        )}
        </div>
      </div>

    </div>
  );
}
