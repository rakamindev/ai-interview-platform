import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  CircleCheck,
  Clock3,
  Code,
  Code2,
  Group,
  Headphones,
  Mic,
  MicOff,
  PersonStanding,
  Radio,
  ShieldCheck,
  Sparkles,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";

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
import HardwareCheck from "@/components/HardwareCheck";

import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";

import { sessionsApi } from "@/services/sessions";

import type {
  CandidateInfo,
  InterviewSpeaker,
  InterviewState,
  TranscriptTurn,
} from "@/types";

type CandidateInfoWithExpiration = CandidateInfo & {
  expires_at?: string | null;
  invitation_expired?: boolean;
};

type InvitationViewState = "loading" | "ready" | "expired" | "error";

function isPendingInvitationExpired(info: CandidateInfoWithExpiration): boolean {
  if (info.session_status !== "pending") return false;

  return (
    info.invitation_expired === true ||
    (info.expires_at != null &&
      new Date(info.expires_at).getTime() <= Date.now())
  );
}

function isGoneError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return false;
  }

  const response = error.response;
  return (
    typeof response === "object" &&
    response !== null &&
    "status" in response &&
    response.status === 410
  );
}

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();

  const [candidateInfo, setCandidateInfo] =
    useState<CandidateInfoWithExpiration | null>(null);

  const [invitationViewState, setInvitationViewState] =
    useState<InvitationViewState>("loading");

  const [sessionId, setSessionId] =
    useState<number | null>(null);

  const [interviewState, setInterviewState] =
    useState<InterviewState>("idle");

  const [speaker, setSpeaker] =
    useState<InterviewSpeaker>(null);

  const [transcript, setTranscript] = useState<
    Pick<TranscriptTurn, "speaker" | "text">[]
  >([]);

  const [hardwareCheckDone, setHardwareCheckDone] =
    useState(false);

  const [connectionLostLong, setConnectionLostLong] =
    useState(false);

  const [reconnectedPrompt, setReconnectedPrompt] =
    useState(false);

  const [micMuted, setMicMuted] = useState(false);

  const reconnectedPromptTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectionLostTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const micMutedRef = useRef(false);

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  const audioCompleteCalledRef = useRef(false);

  const audioCompleteSafetyTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token) {
      setInvitationViewState("error");
      return;
    }

    let cancelled = false;
    setInvitationViewState("loading");

    const loadSession = async () => {
      try {
        const response = await sessionsApi.getCandidateInfo(token);
        if (cancelled) return;

        const info = response.data as CandidateInfoWithExpiration;
        setCandidateInfo(info);
        setSessionId(info.session_id);

        if (isPendingInvitationExpired(info)) {
          setInvitationViewState("expired");
          return;
        }

        setInvitationViewState("ready");

        if (info.session_status === "ended") {
          setInterviewState("complete");
        }
      } catch (error) {
        if (!cancelled) {
          setInvitationViewState(isGoneError(error) ? "expired" : "error");
        }
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Refresh the invitation view when a pending invitation expires while
  // the candidate is still on the device-check screen.
  useEffect(() => {
    if (
      invitationViewState !== "ready" ||
      interviewState !== "idle" ||
      !candidateInfo ||
      candidateInfo.session_status !== "pending" ||
      !candidateInfo.expires_at
    ) {
      return;
    }

    const remaining = new Date(candidateInfo.expires_at).getTime() - Date.now();
    if (remaining <= 0) {
      setInvitationViewState("expired");
      return;
    }

    const timer = window.setTimeout(() => {
      setInvitationViewState("expired");
    }, Math.min(remaining, 2_147_483_647));

    return () => window.clearTimeout(timer);
  }, [candidateInfo, interviewState, invitationViewState]);

  const {
    playChunk,
    stop: stopPlayback,
    scheduleAfterPlayback,
    waitForDrain,
    cancelDrain,
  } = useAudioPlayback();

  const callAudioComplete = useCallback(async () => {
    if (
      audioCompleteCalledRef.current ||
      !token
    ) {
      return;
    }

    audioCompleteCalledRef.current = true;

    cancelDrain();

    if (audioCompleteSafetyTimerRef.current) {
      clearTimeout(
        audioCompleteSafetyTimerRef.current
      );

      audioCompleteSafetyTimerRef.current = null;
    }

    const attempt = async (delay: number) => {
      try {
        await sessionsApi.audioComplete(token);
      } catch {
        window.setTimeout(() => {
          void attempt(
            Math.min(delay * 2, 8000)
          );
        }, delay);
      }
    };

    void attempt(2000);
  }, [token, cancelDrain]);

  const handleStateChange = useCallback(
    (state: InterviewState) => {
      setInterviewState(state);

      if (state === "draining_audio") {
        muteRef.current?.();

        audioCompleteCalledRef.current = false;

        audioCompleteSafetyTimerRef.current =
          window.setTimeout(() => {
            void callAudioComplete();
          }, 10000);

        waitForDrain(() => {
          void callAudioComplete();
        });

        return;
      }

      if (state === "reconnecting") {
        muteRef.current?.();

        connectionLostTimerRef.current =
          window.setTimeout(() => {
            setConnectionLostLong(true);
          }, 60000);
      } else {
        if (connectionLostTimerRef.current) {
          clearTimeout(
            connectionLostTimerRef.current
          );

          connectionLostTimerRef.current = null;
        }

        setConnectionLostLong(false);

        if (
          state === "active" &&
          !micMutedRef.current
        ) {
          unmuteRef.current?.();
        }
      }
    },
    [callAudioComplete, waitForDrain]
  );

  const handleReconnected = useCallback(() => {
    if (reconnectedPromptTimerRef.current) {
      clearTimeout(
        reconnectedPromptTimerRef.current
      );
    }

    setReconnectedPrompt(true);

    reconnectedPromptTimerRef.current =
      window.setTimeout(() => {
        setReconnectedPrompt(false);
      }, 10000);
  }, []);

  const handleTranscript = useCallback(
    (
      turn: Pick<
        TranscriptTurn,
        "speaker" | "text"
      >
    ) => {
      setTranscript((previous) => [
        ...previous.slice(-9),
        turn,
      ]);
    },
    []
  );

  const handleSpeakerChange = useCallback(
    (newSpeaker: InterviewSpeaker) => {
      if (newSpeaker === "ai") {
        setSpeaker("ai");
        muteRef.current?.();
        return;
      }

      if (newSpeaker === "candidate") {
        scheduleAfterPlayback(() => {
          setSpeaker("candidate");

          if (!micMutedRef.current) {
            unmuteRef.current?.();
          }
        });
      }
    },
    [scheduleAfterPlayback]
  );

  const {
    connect,
    send,
    sendJson,
    disconnect,
    connectionState,
  } = useAudioWebSocket({
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
    if (!sessionId || !token || invitationViewState !== "ready") return;

    // Revalidate against the server immediately before starting. This also
    // protects against expiration during a lengthy device check.
    try {
      const response = await sessionsApi.getCandidateInfo(token);
      const latestInfo = response.data as CandidateInfoWithExpiration;

      if (isPendingInvitationExpired(latestInfo)) {
        setInvitationViewState("expired");
        return;
      }

      setCandidateInfo(latestInfo);
      setHardwareCheckDone(true);
      setInterviewState("connecting");
      connect();
      await startCapture();
      muteRef.current?.();
    } catch (error) {
      if (isGoneError(error)) {
        setInvitationViewState("expired");
      } else {
        // Keep Device Check visible so the candidate can retry.
        setInvitationViewState("error");
      }
    }
  }, [sessionId, token, invitationViewState, connect, startCapture]);

  const endInterview = useCallback(
    async () => {
      setInterviewState("ending");

      if (reconnectedPromptTimerRef.current) {
        clearTimeout(
          reconnectedPromptTimerRef.current
        );
      }

      stopCapture();
      stopPlayback();

      sendJson({
        type: "end_session",
      });

      disconnect();

      setInterviewState("complete");
    },
    [
      stopCapture,
      stopPlayback,
      sendJson,
      disconnect,
    ]
  );

  const wsConnectionStatus =
    interviewState === "reconnecting"
      ? connectionLostLong
        ? "lost"
        : "reconnecting"
      : connectionState === "connected"
        ? "connected"
        : "reconnecting";

  const isResumingSession =
    candidateInfo?.session_status === "active";

  if (invitationViewState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f9f9] px-5">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Checking your invitation...</p>
        </div>
      </div>
    );
  }

  if (invitationViewState === "expired") {
    return (
      <div className="min-h-screen bg-[#f6f9f9] text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                <Code2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Rakamin</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
                  AI Interview
                </p>
              </div>
            </div>
            <div className="hidden items-center gap-2 text-xs font-medium text-slate-500 sm:flex">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Secure interview session
            </div>
          </div>
        </header>

        <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center px-5 py-12">
          <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Clock3 className="h-8 w-8" />
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.15em] text-amber-700">
              Invitation Expired
            </p>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Your interview link has expired
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-500">
              This invitation is no longer valid. Please contact your recruiter
              to request a new interview invitation.
            </p>
            {candidateInfo?.expires_at && (
              <div className="mt-7 rounded-2xl border border-amber-100 bg-amber-50 p-5 text-left">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                  Invitation expired on
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {new Intl.DateTimeFormat("en-GB", {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone: "Asia/Jakarta",
                  }).format(new Date(candidateInfo.expires_at))} WIB
                </p>
              </div>
            )}
            <p className="mt-7 text-xs text-slate-400">
              You can safely close this page.
            </p>
          </section>
        </main>
      </div>
    );
  }

  if (invitationViewState === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f9f9] px-5 py-12">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            Unable to verify your invitation
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            We could not confirm your invitation status. Please check your connection
            and reload this page. If the problem persists, contact your recruiter.
          </p>
          <Button className="mt-6" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (interviewState === "idle") {
    return (
      <div className="min-h-screen bg-[#f6f9f9] text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                <Code2 className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm font-bold text-slate-900">
                  Rakamin
                </p>

                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
                  AI Interview
                </p>
              </div>
            </div>

            <div className="hidden items-center gap-2 text-xs font-medium text-slate-500 sm:flex">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Secure interview session
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
            <section className="space-y-7">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                  <Radio className="h-3.5 w-3.5" />
                  Candidate Interview
                </div>

                <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                  {candidateInfo?.role_title ??
                    "AI Interview"}
                </h1>

                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
                  Complete a short device check before
                  starting. Once the interview begins,
                  the AI interviewer will guide the
                  conversation naturally.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Clock3 className="h-5 w-5" />
                  </div>

                  <p className="mt-4 text-sm font-semibold text-slate-900">
                    Interview duration
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Up to{" "}
                    <span className="font-semibold text-slate-700">
                      {candidateInfo?.time_limit_min ??
                        "—"}{" "}
                      minutes
                    </span>
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                    <Mic className="h-5 w-5" />
                  </div>

                  <p className="mt-4 text-sm font-semibold text-slate-900">
                    Voice interview
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Your microphone will be used
                    throughout the session.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-bold text-slate-900">
                  Before you begin
                </h2>

                <div className="mt-5 space-y-4">
                  {[
                    "Choose a quiet place with minimal background noise.",
                    "The AI may ask follow-up questions based on your answers.",
                    "Answer naturally. There is no fixed script.",
                    "You can end the interview manually at any time.",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3"
                    >
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />

                      <p className="text-sm leading-6 text-slate-600">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
                  Device Check
                </p>

                <h2 className="mt-2 text-xl font-bold text-slate-900">
                  Ready to start?
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  We’ll quickly verify your browser,
                  internet, microphone, and audio output.
                </p>
              </div>

              <div className="p-5 sm:p-6">
                {!hardwareCheckDone ? (
                  <HardwareCheck
                    onStart={() => {
                      void startInterview();
                    }}
                  />
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                      <div>
                        <p className="text-sm font-semibold text-emerald-900">
                          Device check passed
                        </p>

                        <p className="mt-1 text-xs leading-5 text-emerald-700">
                          Your setup is ready for the
                          interview.
                        </p>
                      </div>
                    </div>

                    <Button
                      className="h-12 w-full rounded-xl"
                      size="lg"
                      onClick={() => {
                        void startInterview();
                      }}
                    >
                      <Mic className="mr-2 h-4 w-4" />

                      {isResumingSession
                        ? "Resume Interview"
                        : "Start Interview"}
                    </Button>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </main>
      </div>
    );
  }

  if (interviewState === "complete") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f9f9] px-5 py-12">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.15em] text-primary">
            Interview Finished
          </p>

          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Thank you for completing the interview
          </h1>

          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-500">
            Your responses have been recorded
            successfully. The hiring team will review
            your interview and contact you regarding
            the next steps.
          </p>

          <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />

              <div>
                <p className="text-sm font-semibold text-slate-900">
                  You can safely close this page
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  No further action is required from
                  you at this time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const aiSpeaking = speaker === "ai";
  const candidateSpeaking =
    speaker === "candidate";

  return (
    <div className="min-h-screen bg-[#f6f9f9] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">
              {candidateInfo?.role_title ??
                "AI Interview"}
            </p>

            <p className="mt-0.5 text-xs text-slate-500">
              Live interview session
            </p>
          </div>

          {candidateInfo && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <InterviewTimer
                totalSeconds={
                  candidateInfo.time_limit_min *
                  60
                }
                running={
                  interviewState === "active"
                }
                onExpired={endInterview}
              />
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col px-5 py-6 sm:px-8">
        {interviewState === "reconnecting" && (
          <div
            className={`mb-5 flex items-start gap-3 rounded-xl border p-4 ${
              connectionLostLong
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {connectionLostLong ? (
              <WifiOff className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <Wifi className="mt-0.5 h-5 w-5 shrink-0" />
            )}

            <div>
              <p className="text-sm font-semibold">
                {connectionLostLong
                  ? "Connection is taking longer than expected"
                  : "Reconnecting to interview"}
              </p>

              <p className="mt-1 text-xs leading-5">
                {connectionLostLong
                  ? "Please keep this page open while we try to restore the connection."
                  : "Please wait a moment. Your interview will continue automatically."}
              </p>
            </div>
          </div>
        )}

        {reconnectedPrompt && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-800">
            <div className="flex items-start gap-3">
              <Wifi className="mt-0.5 h-5 w-5 shrink-0" />

              <div>
                <p className="text-sm font-semibold">
                  Connection restored
                </p>

                <p className="mt-1 text-xs leading-5">
                  Continue your answer naturally to
                  resume the conversation.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setReconnectedPrompt(false);
              }}
              className="text-sm text-sky-600 hover:text-sky-800"
            >
              Close
            </button>
          </div>
        )}

        <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Live Interview
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Speak naturally when it is your turn.
                </p>
              </div>

              <ConnectionStatus
                state={wsConnectionStatus}
              />
            </div>

            <div className="flex flex-1 flex-col items-center justify-center px-5 py-8 sm:px-6">
              {interviewState === "connecting" ? (
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Radio className="h-8 w-8 animate-pulse" />
                  </div>

                  <p className="mt-5 text-sm font-semibold text-slate-900">
                    Connecting to interview
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    This should only take a moment.
                  </p>
                </div>
              ) : interviewState ===
                "draining_audio" ? (
                <div className="text-center">
                  <VoiceBars
                    active
                    label="AI speaking"
                    variant="ai"
                  />

                  <p className="mt-4 text-sm text-slate-500">
                    Finishing the conversation...
                  </p>
                </div>
              ) : (
                <div className="w-full space-y-7">
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <div
                      className={`flex h-20 w-20 items-center justify-center rounded-full transition-colors ${
                        aiSpeaking
                          ? "bg-primary/10 text-primary"
                          : candidateSpeaking
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {candidateSpeaking ? (
                        <Mic className="h-8 w-8" />
                      ) : (
                        <Volume2 className="h-8 w-8" />
                      )}
                    </div>

                    <p className="mt-4 text-lg font-bold text-slate-900">
                      {aiSpeaking
                        ? "AI is speaking"
                        : candidateSpeaking
                          ? "Your turn to speak"
                          : "Listening for the next turn"}
                    </p>

                    <p className="mt-2 text-sm text-slate-500">
                      {aiSpeaking
                        ? "Please listen to the question before answering."
                        : candidateSpeaking
                          ? "Answer naturally and take your time."
                          : "The interview will continue automatically."}
                    </p>

                    <div className="mt-5">
                      <VoiceBars
                        active={
                          aiSpeaking ||
                          candidateSpeaking
                        }
                        label={
                          aiSpeaking
                            ? "AI speaking"
                            : candidateSpeaking
                              ? "Listening"
                              : "Waiting"
                        }
                        variant={
                          candidateSpeaking
                            ? "candidate"
                            : "ai"
                        }
                      />
                    </div>
                  </div>

                  {transcript.length > 0 && (
                    <div className="border-t border-slate-100 pt-6">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Conversation
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Latest interview messages
                          </p>
                        </div>
                      </div>

                      <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
                        {transcript.map(
                          (turn, index) => (
                            <TranscriptBubble
                              key={`${turn.speaker}-${index}`}
                              speaker={
                                turn.speaker
                              }
                              text={turn.text}
                            />
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-slate-900">
                Interview status
              </p>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-slate-400" />

                    <span className="text-xs font-medium text-slate-600">
                      Connection
                    </span>
                  </div>

                  <span className="text-xs font-semibold text-slate-800">
                    {wsConnectionStatus ===
                    "connected"
                      ? "Connected"
                      : wsConnectionStatus ===
                          "lost"
                        ? "Lost"
                        : "Reconnecting"}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-slate-400" />

                    <span className="text-xs font-medium text-slate-600">
                      Microphone
                    </span>
                  </div>

                  <span className="text-xs font-semibold text-slate-800">
                    {micMuted
                      ? "Muted"
                      : "Active"}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-slate-400" />

                    <span className="text-xs font-medium text-slate-600">
                      Current turn
                    </span>
                  </div>

                  <span className="text-xs font-semibold text-slate-800">
                    {aiSpeaking
                      ? "AI"
                      : candidateSpeaking
                        ? "You"
                        : "Waiting"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-slate-900">
                Controls
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                You can mute your microphone temporarily
                or end the interview early.
              </p>

              <div className="mt-5 space-y-3">
                <Button
                  type="button"
                  variant={
                    micMuted
                      ? "destructive"
                      : "outline"
                  }
                  className="h-11 w-full rounded-xl"
                  onClick={toggleMic}
                >
                  {micMuted ? (
                    <>
                      <MicOff className="mr-2 h-4 w-4" />
                      Microphone Muted
                    </>
                  ) : (
                    <>
                      <Mic className="mr-2 h-4 w-4" />
                      Microphone On
                    </>
                  )}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      End Interview
                    </Button>
                  </AlertDialogTrigger>

                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        End the interview?
                      </AlertDialogTitle>

                      <AlertDialogDescription>
                        Your current interview will
                        end immediately. You may not
                        be able to continue afterward.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        Continue Interview
                      </AlertDialogCancel>

                      <AlertDialogAction
                        onClick={() => {
                          void endInterview();
                        }}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        End Interview
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {import.meta.env.DEV && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  disabled={
                    interviewState ===
                    "reconnecting"
                  }
                  onClick={() =>
                    sendJson({
                      type: "debug_force_reconnect",
                    })
                  }
                >
                  Force reconnect
                </Button>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}