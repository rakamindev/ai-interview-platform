import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { Skeleton } from "@/components/ui/skeleton";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
import PageHeader from "@/components/layout/PageHeader";
import StatePanel from "@/components/layout/StatePanel";
import { useCoverageWebSocket } from "@/hooks/useCoverageWebSocket";
import { sessionsApi } from "@/services/sessions";
import {
  COVERAGE_STATE_LABELS,
  COVERAGE_STATE_WIDTH,
  COVERAGE_STATE_COLOR,
} from "@/utils/constants";
import { ArrowLeft, CheckCircle, Clock, Radio, Zap } from "lucide-react";
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
    <span className="flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
      {mm}:{ss}
    </span>
  );
}

export default function LiveMonitorPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [assessmentName, setAssessmentName] = useState<string>("");
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const lastTurnRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { coverageMap, sessionEnded, sessionEndReason, isConnected } =
    useCoverageWebSocket(Number(sessionId));

  useEffect(() => {
    if (sessionEnded) {
      setSessionActive(false);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
  }, [sessionEnded]);

  useEffect(() => {
    Promise.all([
      sessionsApi.get(Number(sessionId)),
      sessionsApi.getTranscript(Number(sessionId)),
    ])
      .then(([sRes, tRes]) => {
        const s = sRes.data.session as any;
        setStartedAt(s.started_at ?? null);
        setAssessmentName(s.assessment?.name ?? "");
        if (s.status !== "active") setSessionActive(false);

        const turns = tRes.data.turns;
        setTranscript(turns.slice(-10));
        if (turns.length > 0) {
          lastTurnRef.current = turns[turns.length - 1].turn_number;
        }
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  const fetchNewTurns = useCallback(async () => {
    try {
      const res = await sessionsApi.getTranscript(
        Number(sessionId),
        lastTurnRef.current + 1
      );
      if (res.data.turns.length > 0) {
        setTranscript((prev) => [...prev, ...res.data.turns].slice(-10));
        lastTurnRef.current = res.data.turns[res.data.turns.length - 1].turn_number;
      }
    } catch {
      // transient
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionActive || loading) return;
    pollTimerRef.current = setInterval(fetchNewTurns, 3000);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [sessionActive, loading, fetchNewTurns]);

  const handleEndSession = async () => {
    setEnding(true);
    try {
      await sessionsApi.endSession(Number(sessionId));
      navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`);
    } catch {
      setEnding(false);
      setEndError(true);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const configuredSkills = coverageMap?.skills ?? [];
  const discoveredSkills = coverageMap?.discovered ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        back={
          <Link to={`/assessments/${id}/invite`} className="text-muted-foreground hover:text-foreground mt-1.5">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        }
        title="Live Monitor"
        subtitle={assessmentName || undefined}
        actions={
          <div className="flex items-center gap-3">
            {startedAt && sessionActive && <ElapsedTimer startedAt={startedAt} />}
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium",
                isConnected ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Radio className={cn("h-3 w-3", isConnected && "animate-pulse")} />
              {isConnected ? "Live" : "Reconnecting…"}
            </span>
          </div>
        }
      />

      {sessionEnded && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 border border-primary/25 bg-accent/50 px-4 py-3">
          <div className="flex items-start gap-2 text-sm flex-1 min-w-0">
            <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">Session ended</span>
              {sessionEndReason && (
                <span className="text-muted-foreground ml-1.5">
                  — {sessionEndReason.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 w-full sm:w-auto"
            onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
          >
            View portfolio →
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Coverage scoreboard */}
        <section className="border border-foreground/10 bg-card/50 px-4 py-4 space-y-4 order-2 lg:order-1">
          <h2 className="font-display text-lg font-semibold tracking-tight">Coverage</h2>
          {configuredSkills.length === 0 && discoveredSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">Waiting for interview to begin…</p>
          ) : (
            configuredSkills.map((skill) => (
              <div key={skill.id ?? skill.skill_label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium truncate">{skill.skill_label}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    {skill.probe_count > 0 && (
                      <span>{skill.probe_count} probe{skill.probe_count !== 1 ? "s" : ""}</span>
                    )}
                    <span className="capitalize">{COVERAGE_STATE_LABELS[skill.state]}</span>
                  </div>
                </div>
                <Progress
                  value={COVERAGE_STATE_WIDTH[skill.state]}
                  indicatorClassName={COVERAGE_STATE_COLOR[skill.state]}
                  className="h-1.5"
                />
                {skill.last_signal && (
                  <p className="text-xs text-muted-foreground truncate">
                    &ldquo;{skill.last_signal}&rdquo;
                  </p>
                )}
              </div>
            ))
          )}

          {discoveredSkills.length > 0 && (
            <div className="space-y-3 border-t border-foreground/10 pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Discovered
              </p>
              {discoveredSkills.map((skill) => (
                <div key={skill.id ?? skill.skill_label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1 truncate font-medium">
                      <Zap className="h-3 w-3 shrink-0" />
                      {skill.skill_label}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize shrink-0">
                      {COVERAGE_STATE_LABELS[skill.state]}
                    </span>
                  </div>
                  <Progress
                    value={COVERAGE_STATE_WIDTH[skill.state]}
                    indicatorClassName="bg-secondary"
                    className="h-1.5"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Live transcript */}
        <section className="border border-foreground/10 bg-card/50 px-4 py-4 space-y-3 order-1 lg:order-2">
          <h2 className="font-display text-lg font-semibold tracking-tight">Live transcript</h2>
          {transcript.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transcript yet.</p>
          ) : (
            <div className="space-y-2.5 max-h-[28rem] overflow-y-auto pr-1">
              {transcript.map((turn) => (
                <TranscriptBubble key={turn.id} speaker={turn.speaker} text={turn.text} />
              ))}
            </div>
          )}
        </section>
      </div>

      {endError && (
        <StatePanel variant="error" title="Failed to end session" description="Please try again." />
      )}

      <div className="flex justify-end">
        {sessionActive ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={ending} className="w-full sm:w-auto">
                {ending ? "Ending…" : "End Session"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End the session now?</AlertDialogTitle>
                <AlertDialogDescription>
                  The interview will stop and portfolio generation will begin.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleEndSession}>End Session</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
          >
            View portfolio →
          </Button>
        )}
      </div>
    </div>
  );
}
