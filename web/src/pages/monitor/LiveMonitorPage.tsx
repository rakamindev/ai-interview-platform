import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import CoverageTrack from "@/components/monitor/CoverageTrack";
import Page from "@/components/layout/Page";
import Breadcrumb from "@/components/layout/Breadcrumb";
import { useCoverageWebSocket } from "@/hooks/useCoverageWebSocket";
import { sessionsApi } from "@/services/sessions";
import { COVERAGE_STATE_LABELS } from "@/utils/constants";
import { ArrowLeft, ArrowRight, CheckCircle, Clock, Radio, Zap } from "lucide-react";
import type { TranscriptTurn, CoverageSkill } from "@/types";
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
    <span className="flex items-center gap-1 font-mono text-sm tabular-nums text-muted-foreground">
      <Clock className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">Elapsed:</span>
      {mm}:{ss}
    </span>
  );
}

/**
 * One skill on the coverage map. Configured and discovered skills share this
 * row so the assessor compares them on the same instrument — a skill the AI
 * found on its own is not measured differently from one that was planned.
 */
function CoverageRow({ skill }: { skill: CoverageSkill }) {
  const untouched = skill.state === "not_yet";

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <span
          className={cn(
            "flex min-w-0 items-center gap-1.5 [overflow-wrap:anywhere]",
            untouched ? "text-muted-foreground" : "font-medium",
          )}
        >
          {skill.is_discovered && <Zap className="h-3 w-3 shrink-0 text-secondary" aria-hidden />}
          {skill.skill_label}
        </span>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          {skill.probe_count > 0 && (
            <span className="font-mono tabular-nums text-muted-foreground">
              {skill.probe_count} probe{skill.probe_count !== 1 ? "s" : ""}
            </span>
          )}
          <span className={untouched ? "text-attention" : "text-muted-foreground"}>
            {COVERAGE_STATE_LABELS[skill.state]}
          </span>
        </div>
      </div>

      <CoverageTrack state={skill.state} />

      {skill.last_signal && (
        /* The candidate's own words, so they carry the serif and are not
           truncated: the phrase that moved a skill forward is the evidence an
           assessor is actually reading this panel for. */
        <blockquote className="border-l-2 border-border pl-2.5 font-serif text-[13px] leading-relaxed text-foreground/80 [overflow-wrap:anywhere]">
          &ldquo;{skill.last_signal}&rdquo;
        </blockquote>
      )}
    </div>
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
      <Page width="board" className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </Page>
    );
  }

  const configuredSkills = coverageMap?.skills ?? [];
  const discoveredSkills = coverageMap?.discovered ?? [];
  const allSkills = [...configuredSkills, ...discoveredSkills];
  const untouchedCount = allSkills.filter((s) => s.state === "not_yet").length;
  const coveredCount = allSkills.filter((s) => s.state === "covered").length;

  return (
    <Page width="board" className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <Breadcrumb
            crumbs={[
              { label: "Assessments", to: "/assessments" },
              { label: assessmentName || "Candidates", to: `/assessments/${id}/invite` },
              { label: "Live Monitor" },
            ]}
          />
          <h1 className="text-lg font-semibold">Live Monitor</h1>
        </div>

        <div className="flex items-center gap-3">
          {startedAt && sessionActive && <ElapsedTimer startedAt={startedAt} />}
          <span className={cn(
            "flex items-center gap-1 text-xs",
            isConnected ? "text-ok" : "text-attention"
          )}>
            <Radio className="h-3 w-3" aria-hidden />
            {isConnected ? "Live" : "Reconnecting..."}
          </span>
        </div>
      </div>

      {/* Session ended banner */}
      {sessionEnded && (
        <div className="flex items-center gap-2 text-sm bg-muted/50 border rounded-lg px-4 py-3">
          <CheckCircle className="h-4 w-4 shrink-0 text-ok" aria-hidden />
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
            View portfolio <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Two columns once there is room: coverage is what the assessor acts on,
          the transcript is what they read while deciding. Stacked below lg. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
      {/* Coverage map */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Coverage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {allSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">Waiting for the interview to begin.</p>
          ) : (
            <>
              {/* The count of skills nobody has asked about yet is the only
                  number on this screen that can still change the outcome while
                  the interview is running, so it is stated in words up front
                  instead of being left for the assessor to count off bars. */}
              <div
                className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
                data-testid="coverage-summary"
              >
                {untouchedCount > 0 ? (
                  <>
                    <span className="font-mono font-medium tabular-nums text-attention">
                      {untouchedCount}
                    </span>
                    <span className="text-attention">
                      of {allSkills.length} skill{allSkills.length !== 1 ? "s" : ""} not probed yet
                    </span>
                  </>
                ) : (
                  <span className="text-ok">Every skill has been probed at least once.</span>
                )}
                <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                  {coveredCount}/{allSkills.length} covered
                </span>
              </div>

              {configuredSkills.map((skill) => (
                <CoverageRow key={skill.id ?? skill.skill_label} skill={skill} />
              ))}

              {discoveredSkills.length > 0 && (
                <>
                  {configuredSkills.length > 0 && <Separator />}
                  <div className="space-y-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Discovered during the interview
                    </p>
                    {discoveredSkills.map((skill) => (
                      <CoverageRow key={skill.id ?? skill.skill_label} skill={skill} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Live transcript */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Live transcript</CardTitle>
        </CardHeader>
        <CardContent>
          {transcript.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has been said yet.</p>
          ) : (
            <div className="space-y-2">
              {transcript.map((turn) => (
                <TranscriptBubble
                  key={turn.id}
                  speaker={turn.speaker}
                  text={turn.text}
                  perspective="observer"
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

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
            View portfolio <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </Page>
  );
}
