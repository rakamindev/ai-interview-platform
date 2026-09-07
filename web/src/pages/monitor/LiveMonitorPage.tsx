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
import { AlertTriangle, ArrowLeft, CheckCircle, Clock, Radio, Zap } from "lucide-react";
import type { TranscriptTurn } from "@/types";
import { cn } from "@/lib/utils";

// The clock counted up with nothing to count against, so an assessor watching
// it had no idea whether five minutes remained or fifty. The limit is the
// number that decides whether to step in.
function ElapsedTimer({ startedAt, limitMin }: { startedAt: string; limitMin?: number }) {
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

  const limitSec = limitMin ? limitMin * 60 : null;
  const nearLimit = limitSec !== null && elapsed > limitSec - 300;
  const pastLimit = limitSec !== null && elapsed > limitSec;

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-sm tabular-nums",
        pastLimit ? "text-destructive" : nearLimit ? "text-amber-700" : "text-muted-foreground"
      )}
      title={limitMin ? `Time limit ${limitMin} minutes` : undefined}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      {mm}:{ss}
      {limitMin && <span className="opacity-70">/ {limitMin}:00</span>}
    </span>
  );
}

// Long enough that a candidate giving one thorough answer does not trip it,
// short enough that an assessor can still intervene inside a 45-minute session.
const STALL_MINUTES = 6;

export default function LiveMonitorPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [assessmentName, setAssessmentName] = useState<string>("");
  const [timeLimitMin, setTimeLimitMin] = useState<number | undefined>(undefined);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const lastTurnRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { coverageMap, sessionEnded, sessionEndReason, isConnected } =
    useCoverageWebSocket(Number(sessionId));

  // Fingerprint of the coverage map, so "did anything change" is a string
  // comparison rather than a deep one.
  const coverageFingerprint = JSON.stringify(
    (coverageMap?.skills ?? []).concat(coverageMap?.discovered ?? []).map((sk) => [sk.state, sk.probe_count])
  );
  const [lastMovedAt, setLastMovedAt] = useState<number>(() => Date.now());
  const [coverageStalled, setCoverageStalled] = useState(false);

  useEffect(() => {
    setLastMovedAt(Date.now());
    setCoverageStalled(false);
  }, [coverageFingerprint]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCoverageStalled(Date.now() - lastMovedAt > STALL_MINUTES * 60_000);
    }, 15_000);
    return () => clearInterval(timer);
  }, [lastMovedAt]);

  // On session_ended from WS — stop polling, update local state
  useEffect(() => {
    if (sessionEnded) {
      setSessionActive(false);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
  }, [sessionEnded]);

  // Initial load
  useEffect(() => {
    Promise.all([
      sessionsApi.get(Number(sessionId)),
      sessionsApi.getTranscript(Number(sessionId)),
    ])
      .then(([sRes, tRes]) => {
        const s = sRes.data.session as any;
        setStartedAt(s.started_at ?? null);
        setAssessmentName(s.assessment?.name ?? "");
        setTimeLimitMin(s.assessment?.time_limit_min ?? undefined);
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

  const configuredSkills = coverageMap?.skills ?? [];
  const discoveredSkills = coverageMap?.discovered ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link to={`/assessments/${id}/invite`} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-semibold">Live Monitor</h1>
          </div>
          {assessmentName && (
            <p className="text-sm text-muted-foreground pl-6">{assessmentName}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {startedAt && sessionActive && <ElapsedTimer startedAt={startedAt} limitMin={timeLimitMin} />}
          <span className={cn(
            "flex items-center gap-1 text-xs",
            isConnected ? "text-green-600" : "text-muted-foreground"
          )}>
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

      {/*
        A coverage analysis that keeps failing looks exactly like an interview
        that has not moved on: the map simply stops changing, and nothing on
        this screen says so. The assessor is the only person who can act on it,
        so the silence is worth breaking.
      */}
      {sessionActive && coverageStalled && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="font-medium text-amber-900">Coverage has not moved in a while</p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
              The interview is still running, but no skill has changed state or gained a probe for
              over {STALL_MINUTES} minutes. That usually means the coverage analysis is failing
              rather than that the conversation has stalled.
            </p>
          </div>
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
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{skill.skill_label}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                  // Not truncated. This is the analyzer's stated reason for the
                  // state it chose, and it is the only window an assessor has
                  // into why a skill moved — or stalled. A single clipped line
                  // showed the first few words and hid the reasoning.
                  <p className="break-words text-xs leading-relaxed text-muted-foreground">
                    {skill.last_signal}
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
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-amber-500" />
                        {skill.skill_label}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                      <p className="break-words text-xs leading-relaxed text-muted-foreground">
                        {skill.last_signal}
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
