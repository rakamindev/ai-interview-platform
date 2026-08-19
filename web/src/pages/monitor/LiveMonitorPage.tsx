import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
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
import { useCoverageWebSocket } from "@/hooks/useCoverageWebSocket";
import { sessionsApi } from "@/services/sessions";
import { useToast } from "@/hooks/useToast";
import {
  COVERAGE_STATE_LABELS,
  COVERAGE_STATE_WIDTH,
  COVERAGE_STATE_COLOR,
} from "@/utils/constants";
import {
  Radio,
  Clock,
  CheckCircle,
  Bot,
  User,
  Zap,
  StickyNote,
  ArrowRight,
  Power,
  Loader2,
} from "lucide-react";
import type { TranscriptTurn } from "@/types";
import { cn } from "@/lib/utils";

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <span className="flex items-center gap-1 text-xs font-mono font-bold text-primary px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
      <Clock className="h-3.5 w-3.5" />
      {mm}:{ss}
    </span>
  );
}

export default function LiveMonitorPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [assessmentName, setAssessmentName] = useState<string>("");
  const [candidateName, setCandidateName] = useState<string>("");
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [ending, setEnding] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);

  // Assessor live notes
  const [assessorNotes, setAssessorNotes] = useState(() => {
    return localStorage.getItem(`live_notes_${sessionId}`) || "";
  });

  const lastTurnRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  const { coverageMap, sessionEnded, sessionEndReason, isConnected } =
    useCoverageWebSocket(Number(sessionId));

  // On session_ended from WS
  useEffect(() => {
    if (sessionEnded) {
      setSessionActive(false);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
  }, [sessionEnded]);

  // Initial load
  useEffect(() => {
    if (!sessionId) return;
    Promise.all([
      sessionsApi.get(Number(sessionId)),
      sessionsApi.getTranscript(Number(sessionId)),
    ])
      .then(([sRes, tRes]) => {
        const s = sRes.data.session as any;
        setStartedAt(s.started_at ?? null);
        setAssessmentName(s.assessment?.name ?? "");
        setCandidateName(s.candidate_name ?? "");
        if (s.status !== "active") setSessionActive(false);

        const turns = tRes.data.turns;
        setTranscript(turns);
        if (turns.length > 0) {
          lastTurnRef.current = turns[turns.length - 1].turn_number;
        }
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  // Poll transcript every 2.5s while session is active
  const fetchNewTurns = useCallback(async () => {
    try {
      const res = await sessionsApi.getTranscript(
        Number(sessionId),
        lastTurnRef.current + 1
      );
      if (res.data.turns.length > 0) {
        setTranscript((prev) => [...prev, ...res.data.turns]);
        lastTurnRef.current = res.data.turns[res.data.turns.length - 1].turn_number;
      }
    } catch {
      // transient
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionActive || loading) return;
    pollTimerRef.current = setInterval(fetchNewTurns, 2500);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [sessionActive, loading, fetchNewTurns]);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const handleNotesChange = (text: string) => {
    setAssessorNotes(text);
    if (sessionId) {
      localStorage.setItem(`live_notes_${sessionId}`, text);
    }
  };

  const handleEndSession = async () => {
    setEnding(true);
    try {
      await sessionsApi.endSession(Number(sessionId));
      success("Session ended", "Generating portfolio report...");
      navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`);
    } catch {
      toastError("Failed to end session", "Please try again.");
      setEnding(false);
    }
  };

  if (loading) return <LoadingState rows={5} />;
  if (loadError) return <ErrorState title="Failed to load session" onRetry={() => navigate("/dashboard")} />;

  const configuredSkills = coverageMap?.skills ?? [];
  const discoveredSkills = coverageMap?.discovered ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Interview Monitor"
        description={`${assessmentName} · Candidate: ${candidateName || `Candidate #${sessionId}`}`}
        backHref={`/assessments/${id}/invite`}
        backLabel="Assessment Sessions"
        actions={
          <div className="flex items-center gap-3">
            {startedAt && sessionActive && <ElapsedTimer startedAt={startedAt} />}
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border",
                isConnected
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 animate-pulse"
              )}
            >
              <Radio className="h-3 w-3" />
              {isConnected ? "Live Stream" : "Reconnecting..."}
            </span>
          </div>
        }
      />

      {/* Session Ended Banner */}
      {sessionEnded && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Interview session has completed {sessionEndReason ? `(${sessionEndReason})` : ""}.</span>
          </div>
          <Button
            size="sm"
            onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
          >
            View Portfolio <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      )}

      {/* 2-Column Monitor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live Streaming Transcript (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="shadow-xs flex flex-col h-[50vh] sm:h-[60vh] lg:h-[75vh]">
            <CardHeader className="p-4 pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                <span>Live Streaming Transcript</span>
              </CardTitle>
              <span className="text-[10px] text-muted-foreground font-mono">
                {transcript.length} turns
              </span>
            </CardHeader>
            <CardContent
              ref={transcriptScrollRef}
              className="p-4 flex-1 overflow-y-auto space-y-3"
            >
              {transcript.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground text-xs space-y-2">
                  <Radio className="h-6 w-6 text-primary/60 animate-pulse" />
                  <p>Waiting for conversation stream to start...</p>
                </div>
              ) : (
                transcript.map((turn) => {
                  const isAI = turn.speaker === "ai";
                  return (
                    <div
                      key={turn.id}
                      className={cn(
                        "p-3 rounded-xl border text-xs space-y-1 transition-all",
                        isAI
                          ? "bg-muted/40 border-border text-foreground"
                          : "bg-primary/5 border-primary/20 text-foreground ml-4"
                      )}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className="flex items-center gap-1.5">
                          {isAI ? (
                            <>
                              <Bot className="h-3.5 w-3.5 text-primary" />
                              <span className="text-primary">AI Interviewer</span>
                            </>
                          ) : (
                            <>
                              <User className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                              <span className="text-teal-600 dark:text-teal-400">
                                {candidateName || "Candidate"}
                              </span>
                            </>
                          )}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono font-normal">
                          Turn #{turn.turn_number}
                        </span>
                      </div>
                      <p className="leading-relaxed whitespace-pre-wrap">{turn.text}</p>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Sticky Coverage Tracker & Assessor Live Notes (lg:col-span-5) */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-5">
          {/* Skill Coverage Card */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-3 border-b bg-muted/20">
              <CardTitle className="text-xs font-semibold flex items-center justify-between">
                <span>Rubric Skill Coverage</span>
                <span className="text-[10px] text-muted-foreground">Real-time probes</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5">
              {configuredSkills.length === 0 && discoveredSkills.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  Waiting for interview probes...
                </p>
              ) : (
                configuredSkills.map((skill) => (
                  <div key={skill.id ?? skill.skill_label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{skill.skill_label}</span>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {skill.probe_count > 0 && (
                          <span className="font-mono">{skill.probe_count} probe{skill.probe_count !== 1 ? "s" : ""}</span>
                        )}
                        <span className="capitalize font-bold text-foreground">
                          {COVERAGE_STATE_LABELS[skill.state]}
                        </span>
                      </div>
                    </div>
                    <Progress
                      value={COVERAGE_STATE_WIDTH[skill.state]}
                      indicatorClassName={COVERAGE_STATE_COLOR[skill.state]}
                      className="h-1.5"
                    />
                    {skill.last_signal && (
                      <p className="text-[11px] text-muted-foreground italic truncate">
                        {skill.last_signal}
                      </p>
                    )}
                  </div>
                ))
              )}

              {/* Discovered skills */}
              {discoveredSkills.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 text-amber-600">
                    <Zap className="h-3.5 w-3.5" /> Discovered Competencies
                  </span>
                  {discoveredSkills.map((skill) => (
                    <div key={skill.id ?? skill.skill_label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {skill.skill_label}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {COVERAGE_STATE_LABELS[skill.state]}
                        </span>
                      </div>
                      <Progress
                        value={COVERAGE_STATE_WIDTH[skill.state]}
                        indicatorClassName="bg-amber-400"
                        className="h-1.5"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assessor Live Notes */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-2 border-b bg-muted/20 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <StickyNote className="h-3.5 w-3.5 text-primary" />
                <span>Assessor Live Observations</span>
              </CardTitle>
              <span className="text-[10px] text-muted-foreground">Auto-saved</span>
            </CardHeader>
            <CardContent className="p-3">
              <Textarea
                rows={4}
                placeholder="Jot down quick live observations, candidate tone, problem-solving nuances..."
                value={assessorNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                className="text-xs resize-none"
              />
            </CardContent>
          </Card>

          {/* Action End Session Button */}
          {sessionActive ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full gap-1.5" disabled={ending}>
                  <Power className="h-4 w-4" />
                  {ending ? "Ending session..." : "End Live Session Early"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>End interview session?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will wrap up the Gemini live audio stream and trigger the automated portfolio evaluator immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleEndSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {ending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                    End Session
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              className="w-full gap-1.5"
              onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
            >
              View Generated Portfolio <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
