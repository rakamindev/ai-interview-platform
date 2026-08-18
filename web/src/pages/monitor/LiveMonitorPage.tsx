import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingBlock } from "@/components/shared/EmptyState";
import { StatusPill } from "@/components/shared/StatusPill";
import { useCoverageWebSocket } from "@/hooks/useCoverageWebSocket";
import { sessionsApi } from "@/services/sessions";
import {
  COVERAGE_STATE_LABELS,
  COVERAGE_STATE_WIDTH,
  COVERAGE_STATE_COLOR,
} from "@/utils/constants";
import { ArrowLeft, CheckCircle, Clock, Zap } from "lucide-react";
import type { TranscriptTurn } from "@/types";

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
      // transient poll failure — silently skip, retry on next interval
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
      <div className="max-w-5xl space-y-6">
        <LoadingBlock rows={3} />
      </div>
    );
  }

  const configuredSkills = coverageMap?.skills ?? [];
  const discoveredSkills = coverageMap?.discovered ?? [];

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumb={
          <Link
            to={`/assessments/${id}/invite`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to assessment
          </Link>
        }
        title="Live Monitor"
        description={assessmentName ? <span className="break-anywhere">{assessmentName}</span> : undefined}
        actions={
          <>
            {startedAt && sessionActive && <ElapsedTimer startedAt={startedAt} />}
            {sessionActive && isConnected ? (
              <StatusPill tone="live" pulse>
                Live
              </StatusPill>
            ) : sessionActive ? (
              <StatusPill tone="awaiting">Reconnecting…</StatusPill>
            ) : (
              <StatusPill tone="completed">Ended</StatusPill>
            )}
          </>
        }
      />

      {sessionEnded && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm bg-muted/50 border rounded-lg px-4 py-3">
          <div className="flex items-start gap-2 min-w-0">
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-medium">Session ended</span>
              {sessionEndReason && (
                <span className="text-muted-foreground ml-1.5 break-anywhere">
                  — {sessionEndReason.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="sm:ml-auto shrink-0"
            onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
          >
            View portfolio →
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Coverage Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {configuredSkills.length === 0 && discoveredSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">Waiting for interview to begin...</p>
          ) : (
            configuredSkills.map((skill) => (
              <div key={skill.id ?? skill.skill_label} className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
                  <span className="font-medium break-anywhere min-w-0">{skill.skill_label}</span>
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
                  className="h-2"
                />
                {skill.last_signal && (
                  <p className="text-xs text-muted-foreground break-anywhere">
                    &ldquo;{skill.last_signal}&rdquo;
                  </p>
                )}
              </div>
            ))
          )}

          {discoveredSkills.length > 0 && (
            <>
              {configuredSkills.length > 0 && <Separator />}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Discovered
                </p>
                {discoveredSkills.map((skill) => (
                  <div key={skill.id ?? skill.skill_label} className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
                      <span className="flex items-center gap-1 min-w-0">
                        <Zap className="h-3 w-3 text-amber-500 shrink-0" />
                        <span className="break-anywhere">{skill.skill_label}</span>
                      </span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                        {skill.probe_count > 0 && (
                          <span>{skill.probe_count} probe{skill.probe_count !== 1 ? "s" : ""}</span>
                        )}
                        <span className="capitalize">{COVERAGE_STATE_LABELS[skill.state]}</span>
                      </div>
                    </div>
                    <Progress
                      value={COVERAGE_STATE_WIDTH[skill.state]}
                      indicatorClassName="bg-amber-400"
                      className="h-2"
                    />
                    {skill.last_signal && (
                      <p className="text-xs text-muted-foreground break-anywhere">
                        &ldquo;{skill.last_signal}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Live Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          {transcript.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transcript yet.</p>
          ) : (
            <div className="space-y-2">
              {transcript.map((turn) => (
                <TranscriptBubble key={turn.id} speaker={turn.speaker} text={turn.text} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {endError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive break-anywhere">
          Failed to end session. Please try again.
        </div>
      )}

      <div className="flex justify-end">
        {sessionActive ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={ending}>
                {ending ? "Ending..." : "End Session"}
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
            onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
          >
            View portfolio →
          </Button>
        )}
      </div>
    </div>
  );
}
