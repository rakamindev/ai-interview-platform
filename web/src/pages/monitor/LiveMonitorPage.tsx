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
import { Skeleton } from "@/components/ui/skeleton";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
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
  const [loadError, setLoadError] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const lastTurnRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { coverageMap, sessionEnded, sessionEndReason, isConnected } =
    useCoverageWebSocket(Number(sessionId));

  // On session_ended from WS — stop polling, update local state
  useEffect(() => {
    if (sessionEnded) {
      setSessionActive(false);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
  }, [sessionEnded]);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [sRes, tRes] = await Promise.all([
        sessionsApi.get(Number(sessionId)),
        sessionsApi.getTranscript(Number(sessionId)),
      ]);
      const s = sRes.data.session as any;
      setStartedAt(s.started_at ?? null);
      setAssessmentName(s.assessment?.name ?? "");
      if (s.status !== "active") setSessionActive(false);

      const turns = tRes.data.turns;
      setTranscript(turns.slice(-10));
      if (turns.length > 0) {
        lastTurnRef.current = turns[turns.length - 1].turn_number;
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { loadSession(); }, [loadSession]);

  // Poll transcript every 3s while session is active
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
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="mx-auto max-w-4xl space-y-3 rounded-xl border bg-card p-6">
        <div>
          <h1 className="font-semibold">Live interview could not be loaded</h1>
          <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
        </div>
        <Button variant="outline" onClick={loadSession}>Try again</Button>
        <Button asChild variant="ghost"><Link to={`/assessments/${id}/invite`}>Back to candidates</Link></Button>
      </div>
    );
  }

  const configuredSkills = coverageMap?.skills ?? [];
  const discoveredSkills = coverageMap?.discovered ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-5 border-b pb-6">
        <Link
          to={`/assessments/${id}/invite`}
          className="inline-flex min-h-11 items-center gap-2 rounded-md pr-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Candidates
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">Live interview</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {assessmentName || "Follow the interview as it happens and see skill coverage in real time."}
            </p>
          </div>

          <div className="flex items-center gap-4 sm:shrink-0">
            {startedAt && sessionActive && <ElapsedTimer startedAt={startedAt} />}
            <span role="status" className={cn(
              "flex items-center gap-1.5 text-sm",
              isConnected ? "text-foreground" : "text-muted-foreground"
            )}>
              <Radio aria-hidden="true" className="h-3.5 w-3.5" />
              {isConnected ? "Connected" : "Reconnecting"}
            </span>
          </div>
        </div>
      </div>

      {/* Session ended banner */}
      {sessionEnded && (
        <div className="flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 text-sm sm:flex-row sm:items-center">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <div>
            <span className="font-medium">Session ended</span>
            {sessionEndReason && (
              <span className="text-muted-foreground ml-1.5">
                ({sessionEndReason.replace(/_/g, " ")})
              </span>
            )}
          </div>
          <Button
            variant="outline"
            className="min-h-11 sm:ml-auto"
            onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
          >
            View results
          </Button>
        </div>
      )}

      {/* Coverage map */}
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
                <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 break-words font-medium">{skill.skill_label}</span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:shrink-0">
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
                  <p className="break-words text-xs text-muted-foreground">
                    "{skill.last_signal}"
                  </p>
                )}
              </div>
            ))
          )}

          {/* Discovered skills */}
          {discoveredSkills.length > 0 && (
            <>
              {configuredSkills.length > 0 && <Separator />}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Discovered
                </p>
                {discoveredSkills.map((skill) => (
                  <div key={skill.id ?? skill.skill_label} className="space-y-1.5">
                    <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="min-w-0 break-words flex items-start gap-1">
                        <Zap className="h-3 w-3 text-amber-500" />
                        {skill.skill_label}
                      </span>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:shrink-0">
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
                      <p className="break-words text-xs text-muted-foreground">
                        "{skill.last_signal}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Live transcript */}
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
                <TranscriptBubble
                  key={turn.id}
                  aiLabel="AI interviewer"
                  candidateLabel="Candidate"
                  speaker={turn.speaker}
                  text={turn.text}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {endError && (
        <div className="border border-destructive/40 rounded-lg p-3 text-sm text-destructive">
          Failed to end session. Please try again.
        </div>
      )}

      {/* End Session */}
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
            className="min-h-11"
            onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
          >
            View results
          </Button>
        )}
      </div>
    </div>
  );
}
