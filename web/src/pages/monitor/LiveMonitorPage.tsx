
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Code2,
  Loader2,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Square,
  WifiOff,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

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

import TranscriptBubble from "@/components/interview/TranscriptBubble";

import { useCoverageWebSocket } from "@/hooks/useCoverageWebSocket";

import { sessionsApi } from "@/services/sessions";
import { assessmentsApi } from "@/services/assessments";

import {
  COVERAGE_STATE_LABELS,
  COVERAGE_STATE_WIDTH,
  COVERAGE_STATE_COLOR,
} from "@/utils/constants";

import type { TranscriptTurn } from "@/types";
import { cn } from "@/lib/utils";

// ============================================================
// ELAPSED TIMER
// ============================================================

function ElapsedTimer({
  startedAt,
  endedAt,
}: {
  startedAt: string;
  endedAt?: string | null;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();

    const update = () => {
      const end = endedAt
        ? new Date(endedAt).getTime()
        : Date.now();

      setElapsed(
        Math.max(
          0,
          Math.floor((end - start) / 1000)
        )
      );
    };

    update();

    if (endedAt) return;

    const interval = window.setInterval(
      update,
      1000
    );

    return () => {
      window.clearInterval(interval);
    };
  }, [startedAt, endedAt]);

  const hours = Math.floor(elapsed / 3600);

  const minutes = String(
    Math.floor((elapsed % 3600) / 60)
  ).padStart(2, "0");

  const seconds = String(
    elapsed % 60
  ).padStart(2, "0");

  return (
    <span className="font-mono text-2xl font-bold tabular-nums tracking-tight text-slate-900">
      {hours > 0 ? `${hours}:` : ""}
      {minutes}:{seconds}
    </span>
  );
}

// ============================================================
// LIVE MONITOR PAGE
// ============================================================

export default function LiveMonitorPage() {
  const { id, sessionId } = useParams<{
    id: string;
    sessionId: string;
  }>();

  const navigate = useNavigate();

  const numericSessionId = Number(sessionId);
  const numericAssessmentId = Number(id);

  // ==========================================================
  // STATE
  // ==========================================================

  const [startedAt, setStartedAt] =
    useState<string | null>(null);

  const [endedAt, setEndedAt] =
    useState<string | null>(null);

  const [assessmentName, setAssessmentName] =
    useState("");

  const [transcript, setTranscript] =
    useState<TranscriptTurn[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState(false);

  const [transcriptError, setTranscriptError] =
    useState(false);

  const [ending, setEnding] =
    useState(false);

  const [endError, setEndError] =
    useState(false);

  const [sessionActive, setSessionActive] =
    useState(true);

  const lastTurnRef = useRef(0);

  const pollInFlightRef = useRef(false);

  // ==========================================================
  // WEBSOCKET
  // ==========================================================

  const {
    coverageMap,
    sessionEnded,
    sessionEndReason,
    isConnected,
  } = useCoverageWebSocket(
    numericSessionId
  );

  // ==========================================================
  // ROUTES
  // ==========================================================

  const portfolioUrl =
    `/assessments/${id}/sessions/${sessionId}/portfolio`;

  const invitationUrl =
    `/assessments/${id}/invite`;

  // ==========================================================
  // SESSION STATUS
  // ==========================================================

  useEffect(() => {
    if (sessionEnded) {
      setSessionActive(false);
    }
  }, [sessionEnded]);

  // ==========================================================
  // INITIAL DATA
  // ==========================================================

  const loadInitialData = useCallback(
    async () => {
      if (
        !Number.isInteger(numericSessionId) ||
        numericSessionId <= 0 ||
        !Number.isInteger(numericAssessmentId) ||
        numericAssessmentId <= 0
      ) {
        setLoadError(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(false);

      try {
        const [
          sessionResponse,
          transcriptResponse,
          assessmentResponse,
        ] = await Promise.all([
          sessionsApi.get(
            numericSessionId
          ),

          sessionsApi.getTranscript(
            numericSessionId
          ),

          assessmentsApi.get(
            numericAssessmentId
          ),
        ]);

        const session =
          sessionResponse.data.session;

        const assessment =
          assessmentResponse.data.assessment;

        const turns =
          transcriptResponse.data.turns;

        // Session information

        setStartedAt(
          session.started_at ?? null
        );

        setEndedAt(
          session.ended_at ?? null
        );

        setSessionActive(
          session.status === "active" &&
          !sessionEnded
        );

        // Assessment information
        // Retrieved directly from Assessment API

        setAssessmentName(
          assessment.name ?? ""
        );

        // Initial transcript

        setTranscript(
          turns.slice(-10)
        );

        lastTurnRef.current =
          turns.length > 0
            ? turns[turns.length - 1]
                .turn_number
            : 0;

        setTranscriptError(false);
      } catch (error) {
        console.error(
          "Failed to load live monitor:",
          error
        );

        setLoadError(true);
      } finally {
        setLoading(false);
      }
    },
    [
      numericSessionId,
      numericAssessmentId,
      sessionEnded,
    ]
  );

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  // ==========================================================
  // TRANSCRIPT POLLING
  // ==========================================================

  const fetchNewTurns = useCallback(
    async () => {
      if (
        pollInFlightRef.current ||
        !Number.isInteger(numericSessionId) ||
        numericSessionId <= 0
      ) {
        return;
      }

      pollInFlightRef.current = true;

      try {
        const response =
          await sessionsApi.getTranscript(
            numericSessionId,
            lastTurnRef.current + 1
          );

        const incomingTurns =
          response.data.turns;

        if (incomingTurns.length > 0) {
          setTranscript((previous) => {
            const existingIds =
              new Set(
                previous.map(
                  (turn) => turn.id
                )
              );

            const uniqueTurns =
              incomingTurns.filter(
                (turn) =>
                  !existingIds.has(
                    turn.id
                  )
              );

            return [
              ...previous,
              ...uniqueTurns,
            ].slice(-10);
          });

          lastTurnRef.current =
            Math.max(
              lastTurnRef.current,
              ...incomingTurns.map(
                (turn) =>
                  turn.turn_number
              )
            );
        }

        setTranscriptError(false);
      } catch (error) {
        console.error(
          "Failed to fetch transcript:",
          error
        );

        setTranscriptError(true);
      } finally {
        pollInFlightRef.current = false;
      }
    },
    [numericSessionId]
  );

  useEffect(() => {
    if (
      !sessionActive ||
      loading ||
      loadError
    ) {
      return;
    }

    const interval =
      window.setInterval(() => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void fetchNewTurns();
        }
      }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    sessionActive,
    loading,
    loadError,
    fetchNewTurns,
  ]);

  // ==========================================================
  // END SESSION
  // ==========================================================

  const handleEndSession =
    async () => {
      if (ending) return;

      setEnding(true);
      setEndError(false);

      try {
        await sessionsApi.endSession(
          numericSessionId
        );

        setSessionActive(false);

        navigate(
          portfolioUrl
        );
      } catch (error) {
        console.error(
          "Failed to end session:",
          error
        );

        setEndError(true);
      } finally {
        setEnding(false);
      }
    };

  // ==========================================================
  // COVERAGE DATA
  // ==========================================================

  const configuredSkills =
    coverageMap?.skills ?? [];

  const discoveredSkills =
    coverageMap?.discovered ?? [];

  const allSkills = [
    ...configuredSkills,
    ...discoveredSkills,
  ];

  const coveredSkills =
    allSkills.filter(
      (skill) =>
        COVERAGE_STATE_WIDTH[
          skill.state
        ] >= 100
    ).length;

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Skeleton className="h-10 w-72" />

        <Skeleton className="h-32 rounded-2xl" />

        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-2xl" />

          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  // ==========================================================
  // ERROR STATE
  // ==========================================================

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <AlertCircle className="h-7 w-7" />
        </div>

        <h1 className="mt-5 text-xl font-bold text-slate-900">
          Unable to Load Interview
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          The interview information could
          not be loaded. Please check your
          connection and try again.
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <Button
            variant="outline"
            asChild
          >
            <Link to={invitationUrl}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>

          <Button
            onClick={() =>
              void loadInitialData()
            }
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // ==========================================================
  // MAIN PAGE
  // ==========================================================

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      {/* HEADER */}

      <div className="space-y-5">
        <Link
          to={invitationUrl}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Candidates
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-primary">
              Interview Monitoring
            </p>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Live Monitor
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {assessmentName ||
                "Track interview progress in real time."}
            </p>
          </div>

          {/* CONNECTION STATUS */}

          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold",

              !sessionActive
                ? "border-slate-200 bg-slate-100 text-slate-600"
                : isConnected
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            )}
          >
            {!sessionActive ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Session Ended
              </>
            ) : isConnected ? (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Live Connection
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                Reconnecting
              </>
            )}
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}

      <section className="grid gap-4 sm:grid-cols-3">
        {/* INTERVIEW STATUS */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-slate-500">
              Interview Status
            </p>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Radio className="h-5 w-5" />
            </div>
          </div>

          <p className="mt-4 text-xl font-bold text-slate-900">
            {sessionActive
              ? "In Progress"
              : "Completed"}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Current interview state
          </p>
        </div>

        {/* ELAPSED TIME */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-slate-500">
              Elapsed Time
            </p>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Clock3 className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4">
            {startedAt ? (
              <ElapsedTimer
                startedAt={startedAt}
                endedAt={
                  sessionActive
                    ? null
                    : endedAt
                }
              />
            ) : (
              <p className="text-xl font-bold text-slate-900">
                Not Started
              </p>
            )}
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Since interview started
          </p>
        </div>

        {/* COVERAGE SUMMARY */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-slate-500">
              Competency Coverage
            </p>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Activity className="h-5 w-5" />
            </div>
          </div>

          <p className="mt-4 text-2xl font-bold text-slate-900">
            {coveredSkills}

            <span className="ml-1 text-base font-medium text-slate-400">
              / {allSkills.length}
            </span>
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Fully covered competencies
          </p>
        </div>
      </section>

      {/* SESSION ENDED BANNER */}

      {sessionEnded && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />

            <div>
              <p className="text-sm font-bold text-emerald-900">
                Interview Session Ended
              </p>

              <p className="mt-1 text-xs text-emerald-700">
                {sessionEndReason
                  ? `Reason: ${sessionEndReason.replace(
                      /_/g,
                      " "
                    )}`
                  : "You can now review the interview results."}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() =>
              navigate(portfolioUrl)
            }
            className="rounded-xl border-emerald-200 bg-white text-emerald-700"
          >
            View Portfolio

            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* MAIN CONTENT */}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {/* SKILL COVERAGE */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Skill Coverage
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Interview competency progress
                </p>
              </div>
            </div>

            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {configuredSkills.length} configured
            </span>
          </div>

          <div className="space-y-6 p-5 sm:p-6">
            {allSkills.length === 0 ? (
              <div className="py-12 text-center">
                <Activity className="mx-auto h-9 w-9 text-slate-300" />

                <p className="mt-4 text-sm font-semibold text-slate-700">
                  Waiting for Coverage Data
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Skill progress will appear
                  as the interview proceeds.
                </p>
              </div>
            ) : (
              <>
                {/* CONFIGURED SKILLS */}

                {configuredSkills.map(
                  (skill) => (
                    <div
                      key={
                        skill.id ??
                        skill.skill_label
                      }
                      className="space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-slate-800">
                            {skill.skill_label}
                          </p>

                          {skill.probe_count > 0 && (
                            <p className="mt-1 text-xs text-slate-500">
                              {skill.probe_count}{" "}
                              {skill.probe_count === 1
                                ? "probe"
                                : "probes"}
                            </p>
                          )}
                        </div>

                        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                          {
                            COVERAGE_STATE_LABELS[
                              skill.state
                            ]
                          }
                        </span>
                      </div>

                      <Progress
                        value={
                          COVERAGE_STATE_WIDTH[
                            skill.state
                          ]
                        }
                        indicatorClassName={
                          COVERAGE_STATE_COLOR[
                            skill.state
                          ]
                        }
                        className="h-2"
                      />

                      {skill.last_signal && (
                        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                          {skill.last_signal}
                        </p>
                      )}
                    </div>
                  )
                )}

                {/* DISCOVERED SKILLS */}

                {discoveredSkills.length > 0 && (
                  <div className="space-y-5 border-t border-slate-100 pt-6">
                    <div className="flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-amber-500" />

                      <h3 className="text-sm font-bold text-slate-800">
                        Discovered Skills
                      </h3>
                    </div>

                    {discoveredSkills.map(
                      (skill) => (
                        <div
                          key={
                            skill.id ??
                            skill.skill_label
                          }
                          className="space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                <Zap className="h-4 w-4 text-amber-500" />

                                {skill.skill_label}
                              </p>

                              {skill.probe_count > 0 && (
                                <p className="mt-1 text-xs text-slate-500">
                                  {skill.probe_count} probes
                                </p>
                              )}
                            </div>

                            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                              {
                                COVERAGE_STATE_LABELS[
                                  skill.state
                                ]
                              }
                            </span>
                          </div>

                          <Progress
                            value={
                              COVERAGE_STATE_WIDTH[
                                skill.state
                              ]
                            }
                            indicatorClassName="bg-amber-400"
                            className="h-2"
                          />

                          {skill.last_signal && (
                            <p className="rounded-lg bg-amber-50/60 px-3 py-2 text-xs leading-5 text-slate-600">
                              {skill.last_signal}
                            </p>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* LIVE TRANSCRIPT */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Activity className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Live Transcript
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Latest interview conversation
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                void fetchNewTurns()
              }
              className="rounded-lg"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          <div className="max-h-[650px] min-h-[350px] space-y-4 overflow-y-auto p-5 sm:p-6">
            {transcriptError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />

                Transcript could not be refreshed.
              </div>
            )}

            {transcript.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
                <Activity className="h-9 w-9 text-slate-300" />

                <p className="mt-4 text-sm font-semibold text-slate-700">
                  No Transcript Yet
                </p>

                <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">
                  The conversation will
                  appear here after the
                  interview begins.
                </p>
              </div>
            ) : (
              transcript.map(
                (turn) => (
                  <TranscriptBubble
                    key={turn.id}
                    speaker={
                      turn.speaker
                    }
                    text={
                      turn.text
                    }
                  />
                )
              )
            )}
          </div>
        </section>
      </div>

      {/* END SESSION ERROR */}

      {endError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          Failed to end the session.
          Please try again.
        </div>
      )}

      {/* FOOTER ACTIONS */}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs leading-5 text-slate-500">
          {sessionActive
            ? "Ending the session will stop the interview and start portfolio generation."
            : "The interview has ended. You can review the generated portfolio."}
        </p>

        {sessionActive ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={ending}
                className="h-11 rounded-xl px-5"
              >
                {ending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Square className="mr-2 h-4 w-4" />
                )}

                {ending
                  ? "Ending..."
                  : "End Session"}
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  End the Interview Session?
                </AlertDialogTitle>

                <AlertDialogDescription>
                  The active interview
                  will stop and portfolio
                  generation will begin.
                  This action cannot
                  be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel>
                  Cancel
                </AlertDialogCancel>

                <AlertDialogAction
                  onClick={
                    handleEndSession
                  }
                  className="bg-red-600 hover:bg-red-700"
                >
                  End Session
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            onClick={() =>
              navigate(
                portfolioUrl
              )
            }
            className="h-11 rounded-xl px-5"
          >
            View Portfolio

            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}