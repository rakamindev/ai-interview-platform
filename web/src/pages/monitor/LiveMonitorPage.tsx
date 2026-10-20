import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import MetricStrip from "@/components/workspace/MetricStrip";
import { useCoverageWebSocket } from "@/hooks/useCoverageWebSocket";
import { sessionsApi } from "@/services/sessions";
import {
  COVERAGE_STATE_LABELS,
  COVERAGE_STATE_WIDTH,
  COVERAGE_STATE_COLOR,
} from "@/utils/constants";
import { AlertCircle, ArrowLeft, BarChart3, CheckCircle2, Clock, Loader2, Radio, RefreshCw, Sparkles, Users, Zap } from "lucide-react";
import type { TranscriptTurn } from "@/types";
import { showRequestError } from "@/lib/requestToast";
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
  const [pollError, setPollError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const lastTurnRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollErrorNotifiedRef = useRef(false);

  const { coverageMap, sessionEnded, sessionEndReason, isConnected } =
    useCoverageWebSocket(Number(sessionId));

  // On session_ended from WS — stop polling, update local state
  useEffect(() => {
    if (sessionEnded) {
      setSessionActive(false);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
  }, [sessionEnded]);

  // Initial load
  useEffect(() => {
    setLoadError(false);
    Promise.all([
      sessionsApi.get(Number(sessionId)),
      sessionsApi.getTranscript(Number(sessionId)),
    ])
      .then(([sRes, tRes]) => {
        const s = sRes.data.session as any;
        setStartedAt(s.started_at ?? null);
        setAssessmentName(s.assessment?.name ?? sRes.data.assessment?.name ?? "");
        if (s.status !== "active") setSessionActive(false);

        const turns = tRes.data.turns;
        setTranscript(turns.slice(-10));
        if (turns.length > 0) {
          lastTurnRef.current = turns[turns.length - 1].turn_number;
        }
      })
      .catch((error) => {
        setLoadError(true);
        showRequestError(error, "Couldn’t load the live monitor.");
      })
      .finally(() => setLoading(false));
  }, [sessionId, retryCount]);

  // Poll transcript every 3s while session is active
  const fetchNewTurns = useCallback(async () => {
    try {
      const res = await sessionsApi.getTranscript(
        Number(sessionId),
        lastTurnRef.current + 1
      );
      setPollError(false);
      pollErrorNotifiedRef.current = false;
      if (res.data.turns.length > 0) {
        setTranscript((prev) => [...prev, ...res.data.turns].slice(-10));
        lastTurnRef.current = res.data.turns[res.data.turns.length - 1].turn_number;
      }
    } catch (error) {
      setPollError(true);
      if (!pollErrorNotifiedRef.current) {
        showRequestError(error, "Live transcript updates are temporarily unavailable.");
        pollErrorNotifiedRef.current = true;
      }
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
    } catch (error) {
      setEnding(false);
      setEndError(true);
      showRequestError(error, "Couldn’t end the interview session.");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center gap-3">
          <Link to={`/assessments/${id}/invite`} aria-label="Back to invitations" className="grid h-10 w-10 place-items-center rounded-xl border text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div><h1 className="text-2xl font-semibold tracking-tight">Live monitor</h1><p className="text-sm text-muted-foreground">Session updates are temporarily unavailable.</p></div>
        </div>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6" role="alert">
          <p className="font-medium text-destructive">We could not load this session.</p>
          <p className="mt-1 text-sm text-muted-foreground">The interview itself is unaffected. Retry to follow it again.</p>
          <Button variant="outline" className="mt-4" onClick={() => setRetryCount((count) => count + 1)}><RefreshCw className="h-4 w-4" /> Retry</Button>
        </div>
      </div>
    );
  }

  const configuredSkills = coverageMap?.skills ?? [];
  const discoveredSkills = coverageMap?.discovered ?? [];
  const coveredCount = configuredSkills.filter((skill) => skill.state === "covered").length;
  const partialCount = configuredSkills.filter((skill) => skill.state === "partial" || skill.state === "initiated").length;

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Link to={`/assessments/${id}/invite`} aria-label="Back to invitations" className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary"><Radio className="mr-1.5 h-3 w-3" />Live interview</Badge>
            <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight sm:text-3xl">Live monitor</h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">{assessmentName || "Interview session"} · Session #{sessionId}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
          {startedAt && sessionActive && <ElapsedTimer startedAt={startedAt} />}
          <span role="status" className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium", isConnected ? "border-primary/20 bg-primary/5 text-primary" : "border-secondary/50 bg-secondary/10 text-secondary-foreground")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", isConnected ? "animate-pulse bg-primary" : "bg-secondary-foreground")} />
            {isConnected ? "Live connection" : "Reconnecting"}
          </span>
        </div>
      </div>

      {pollError && <div className="flex items-center gap-3 rounded-2xl border border-secondary/50 bg-secondary/10 p-4" role="status" aria-live="polite"><AlertCircle className="h-5 w-5 shrink-0 text-secondary-foreground" /><p className="text-sm text-secondary-foreground">Transcript updates are paused while the connection recovers. Existing turns remain valid.</p></div>}
      {sessionEnded && <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /><div><p className="font-medium">Session ended</p><p className="text-sm text-muted-foreground">{sessionEndReason?.replace(/_/g, " ") || "The candidate session has ended."}</p></div><Button size="sm" variant="outline" className="sm:ml-auto" onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}>View portfolio</Button></div>}

      <MetricStrip items={[
        { label: "Configured skills", value: configuredSkills.length, icon: BarChart3 },
        { label: "Covered", value: coveredCount, icon: CheckCircle2, className: "text-primary" },
        { label: "In progress", value: partialCount, icon: Clock, className: "text-secondary-foreground" },
        { label: "Discovered", value: discoveredSkills.length, icon: Sparkles, className: "text-secondary-foreground" },
      ]} />

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/70 px-5 py-5 sm:px-7">
          <CardTitle className="flex items-center gap-2 text-xl"><BarChart3 className="h-5 w-5 text-primary" />Coverage Status</CardTitle>
          <p className="text-sm text-muted-foreground">Coverage is operational context; it does not determine the final assessment rating.</p>
        </CardHeader>
        <CardContent className="space-y-5 p-5 sm:p-7">
          {configuredSkills.length === 0 && discoveredSkills.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Waiting for interview to begin...</p> : (
            <>
              {configuredSkills.map((skill) => (
                <div key={skill.id ?? skill.skill_label} className="space-y-2" aria-live="polite">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{skill.skill_label}</span><span className="text-xs text-muted-foreground">{skill.probe_count > 0 ? `${skill.probe_count} probe${skill.probe_count === 1 ? "" : "s"} · ` : ""}{COVERAGE_STATE_LABELS[skill.state]}</span></div>
                  <Progress value={COVERAGE_STATE_WIDTH[skill.state]} indicatorClassName={COVERAGE_STATE_COLOR[skill.state]} className="h-2.5" />
                  {skill.last_signal && <p className="truncate text-xs text-muted-foreground">&quot;{skill.last_signal}&quot;</p>}
                </div>
              ))}
              {discoveredSkills.length > 0 && <><Separator /><div className="space-y-4"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary/25 text-secondary-foreground"><Sparkles className="h-4 w-4" /></span><div><p className="font-medium">Discovered signals</p><p className="text-xs text-muted-foreground">Skills observed outside the configured scope.</p></div></div>{discoveredSkills.map((skill) => <div key={skill.id ?? skill.skill_label} className="space-y-2" aria-live="polite"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{skill.skill_label}</span><span className="text-xs text-muted-foreground">{skill.probe_count > 0 ? `${skill.probe_count} probe${skill.probe_count === 1 ? "" : "s"} · ` : ""}{COVERAGE_STATE_LABELS[skill.state]}</span></div><Progress value={COVERAGE_STATE_WIDTH[skill.state]} indicatorClassName="bg-amber-400" className="h-2.5" /></div>)}</div></>}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/70 px-5 py-5 sm:px-7">
          <CardTitle className="flex items-center gap-2 text-xl"><Users className="h-5 w-5 text-primary" />Live transcript</CardTitle>
          <p className="text-sm text-muted-foreground">The latest turns are kept visible while the session is active.</p>
        </CardHeader>
        <CardContent className="p-5 sm:p-7">
          <div role="log" aria-live="polite" aria-label="Live transcript" className="space-y-3">
            {transcript.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No transcript yet.</p> : transcript.map((turn) => <TranscriptBubble key={turn.id} speaker={turn.speaker} text={turn.text} />)}
          </div>
        </CardContent>
      </Card>

      {endError && <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">Failed to end session. Please try again.</div>}
      <div className="flex justify-end">
        {sessionActive ? (
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive" disabled={ending}>{ending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{ending ? "Ending..." : "End Session"}</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>End the session now?</AlertDialogTitle><AlertDialogDescription>The interview will stop and portfolio generation will begin.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleEndSession}>End Session</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
          </AlertDialog>
        ) : <Button variant="outline" onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}>View portfolio</Button>}
      </div>
    </div>
  );
}
