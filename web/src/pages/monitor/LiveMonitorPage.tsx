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
import { ArrowLeft, CheckCircle, Clock, Radio, Zap, Target, ArrowDown } from "lucide-react";
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

function TimeRemaining({ startedAt, limitMin }: { startedAt: string; limitMin: number }) {
  const [remaining, setRemaining] = useState(limitMin * 60);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => {
      const left = Math.max(0, limitMin * 60 - Math.floor((Date.now() - start) / 1000));
      setRemaining(left);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt, limitMin]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const low = remaining <= 120;
  const warn = remaining <= 300 && !low;
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-sm tabular-nums",
        low ? "text-destructive" : warn ? "text-amber-600" : "text-muted-foreground",
      )}
    >
      <Clock className="h-3.5 w-3.5" />
      {mm}:{ss} left
    </span>
  );
}

export default function LiveMonitorPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [assessmentName, setAssessmentName] = useState<string>("");
  const [roleTitle, setRoleTitle] = useState<string>("");
  const [candidateName, setCandidateName] = useState<string>("");
  const [timeLimitMin, setTimeLimitMin] = useState<number>(0);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const lastTurnRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptBoxRef = useRef<HTMLDivElement | null>(null);

  const { coverageMap, sessionEnded, sessionEndReason, isConnected, liveTurn } =
    useCoverageWebSocket(Number(sessionId));

  // On session_ended from WS — stop polling, update local state
  useEffect(() => {
    if (sessionEnded) {
      setSessionActive(false);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
  }, [sessionEnded]);

  // Append turns streamed over WS; advance lastTurnRef so the polling
  // fallback doesn't re-fetch them.
  useEffect(() => {
    if (!liveTurn) return;
    setTranscript((prev) => {
      if (prev.some((t) => t.id === liveTurn.id)) return prev;
      return [...prev, liveTurn].slice(-10);
    });
    lastTurnRef.current = Math.max(lastTurnRef.current, liveTurn.turn_number);
  }, [liveTurn]);

  useEffect(() => {
    if (autoScroll && transcriptBoxRef.current) {
      transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight;
    }
  }, [transcript, autoScroll]);

  // Initial load
  useEffect(() => {
    void Promise.all([
      sessionsApi.get(Number(sessionId)),
      sessionsApi.getTranscript(Number(sessionId)),
    ])
      .then(([sRes, tRes]) => {
        const s = sRes.data.session as any;
        setStartedAt(s.started_at ?? null);
        setAssessmentName(s.assessment?.name ?? "");
        setRoleTitle(s.assessment?.role_title ?? "");
        setCandidateName(s.candidate_name ?? "");
        setTimeLimitMin(s.assessment?.time_limit_min ?? 0);
        if (s.status !== "active") setSessionActive(false);

        const turns = tRes.data.turns;
        setTranscript(turns.slice(-10));
        if (turns.length > 0) {
          lastTurnRef.current = turns[turns.length - 1].turn_number;
        }
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  // Poll transcript every 3s while session is active
  const fetchNewTurns = useCallback(async () => {
    try {
      const res = await sessionsApi.getTranscript(Number(sessionId), lastTurnRef.current + 1);
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
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [sessionActive, loading, fetchNewTurns]);

  const handleEndSession = async () => {
    setEnding(true);
    try {
      await sessionsApi.endSession(Number(sessionId));
      void navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`);
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

  const configuredSkills = coverageMap?.skills ?? [];
  const discoveredSkills = coverageMap?.discovered ?? [];
  const priorityOrder = ["not_yet", "initiated", "partial", "covered"] as const;
  const priorityNext =
    configuredSkills
      .filter((s) => s.state !== "covered")
      .sort((a, b) => priorityOrder.indexOf(a.state) - priorityOrder.indexOf(b.state))[0] ?? null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/invite`}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-semibold">
              {roleTitle || assessmentName || "Live Monitor"}
            </h1>
          </div>
          <div className="text-sm text-muted-foreground pl-6 space-y-0.5">
            {candidateName && <p className="font-medium text-foreground/80">{candidateName}</p>}
            {assessmentName && assessmentName !== roleTitle && <p>{assessmentName}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {startedAt && sessionActive && <ElapsedTimer startedAt={startedAt} />}
          {startedAt && sessionActive && timeLimitMin > 0 && (
            <TimeRemaining startedAt={startedAt} limitMin={timeLimitMin} />
          )}
          <span
            className={cn(
              "flex items-center gap-1 text-xs",
              isConnected ? "text-green-600" : "text-muted-foreground",
            )}
          >
            <Radio className="h-3 w-3" />
            {isConnected ? "Live" : "Reconnecting..."}
          </span>
        </div>
      </div>

      {/* Session ended banner */}
      {sessionEnded && (
        <div className="flex items-center gap-2 text-sm bg-muted/50 border rounded-lg px-4 py-3">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <div>
            <span className="font-medium">Session ended</span>
            {sessionEndReason && (
              <span className="text-muted-foreground ml-1.5">
                — {sessionEndReason.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
          >
            View portfolio →
          </Button>
        </div>
      )}

      {/* Coverage map */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Coverage Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {priorityNext && (
            <div className="flex items-center gap-2 text-sm bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              <Target className="h-4 w-4 text-primary shrink-0" />
              <span className="text-muted-foreground">Priority next:</span>
              <span className="font-medium">{priorityNext.skill_label}</span>
            </div>
          )}

          {configuredSkills.length === 0 && discoveredSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">Waiting for interview to begin...</p>
          ) : (
            configuredSkills.map((skill) => (
              <div key={skill.id ?? skill.skill_label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{skill.skill_label}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {skill.probe_count > 0 && (
                      <span>
                        {skill.probe_count} probe{skill.probe_count !== 1 ? "s" : ""}
                      </span>
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
                  <p className="text-xs text-muted-foreground truncate">"{skill.last_signal}"</p>
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
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-amber-500" />
                        {skill.skill_label}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {skill.probe_count > 0 && (
                          <span>
                            {skill.probe_count} probe{skill.probe_count !== 1 ? "s" : ""}
                          </span>
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
                      <p className="text-xs text-muted-foreground truncate">
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Live Transcript</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-7 px-2 text-xs", autoScroll && "text-primary")}
              onClick={() => setAutoScroll((v) => !v)}
              aria-pressed={autoScroll}
            >
              <ArrowDown className="h-3 w-3 mr-1" />
              Auto-scroll {autoScroll ? "on" : "off"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {transcript.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transcript yet.</p>
          ) : (
            <div
              ref={transcriptBoxRef}
              className="space-y-2 max-h-96 overflow-y-auto pr-1"
              aria-live="polite"
            >
              {transcript.map((turn) => (
                <TranscriptBubble key={turn.id} speaker={turn.speaker} text={turn.text} />
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
            onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
          >
            View portfolio →
          </Button>
        )}
      </div>
    </div>
  );
}
