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
import { ArrowLeft, CheckCircle, CheckCircle2, Clock, Radio, Zap } from "lucide-react";
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

// Coverage state has 4 steps — map to a friendlier progress width + label
const STATE_ORDER = ["not_yet", "initiated", "partial", "covered"] as const;

function CoverageRow({
  skill,
  discovered = false,
}: {
  skill: { id?: number; skill_label: string; state: string; probe_count: number; last_signal?: string };
  discovered?: boolean;
}) {
  const isCovered = skill.state === "covered";
  const pct = COVERAGE_STATE_WIDTH[skill.state] ?? 0;
  const colorCls = discovered ? "bg-amber-400" : COVERAGE_STATE_COLOR[skill.state];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className={cn("font-medium flex items-center gap-1.5", isCovered && "text-green-700")}>
          {discovered && <Zap className="h-3 w-3 text-amber-500 shrink-0" />}
          {skill.skill_label}
          {isCovered && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
        </span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          {skill.probe_count > 0 && (
            <span>{skill.probe_count} probe{skill.probe_count !== 1 ? "s" : ""}</span>
          )}
          <span
            className={cn(
              "capitalize px-1.5 py-0.5 rounded text-[11px] font-medium",
              isCovered
                ? "bg-green-100 text-green-700"
                : skill.state === "partial"
                  ? "bg-teal-100 text-teal-700"
                  : skill.state === "initiated"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-neutral-100 text-neutral-500"
            )}
          >
            {COVERAGE_STATE_LABELS[skill.state] ?? skill.state}
          </span>
        </div>
      </div>

      {/* Progress bar + percentage */}
      <div className="flex items-center gap-2">
        <Progress
          value={pct}
          indicatorClassName={colorCls}
          className="h-2 flex-1"
        />
        <span className="text-[11px] text-muted-foreground tabular-nums w-7 text-right">
          {pct}%
        </span>
      </div>

      {skill.last_signal && !isCovered && (
        <p className="text-xs text-muted-foreground truncate italic">
          "{skill.last_signal}"
        </p>
      )}
    </div>
  );
}

export default function LiveMonitorPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();

  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [assessmentName, setAssessmentName] = useState<string>("");
  const [candidateName, setCandidateName] = useState<string>("");
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [totalTurns, setTotalTurns] = useState(0);
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
        setCandidateName(s.candidate_name ?? "");
        if (s.status !== "active") setSessionActive(false);

        const turns = tRes.data.turns;
        setTotalTurns(turns.length);
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
        setTotalTurns((n) => n + res.data.turns.length);
        setTranscript((prev) => [...prev, ...res.data.turns].slice(-10));
        lastTurnRef.current = res.data.turns[res.data.turns.length - 1].turn_number;
      }
    } catch {
      // transient — skip
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
  const coveredCount = configuredSkills.filter((s) => s.state === "covered").length;
  const totalConfigured = configuredSkills.length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/invite`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-semibold">Live Monitor</h1>
          </div>
          <div className="pl-6 flex items-center gap-2 text-xs text-muted-foreground">
            {assessmentName && <span>{assessmentName}</span>}
            {candidateName && <><span>·</span><span>{candidateName}</span></>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {startedAt && sessionActive && <ElapsedTimer startedAt={startedAt} />}
          <span
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border",
              isConnected
                ? "text-green-700 bg-green-50 border-green-200"
                : "text-muted-foreground bg-muted border-transparent"
            )}
          >
            <Radio className="h-3 w-3" />
            {isConnected ? "Live" : "Reconnecting…"}
          </span>
        </div>
      </div>

      {/* ── Session ended banner ───────────────────────────────────────────── */}
      {sessionEnded && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-green-800">Session ended</span>
            {sessionEndReason && (
              <span className="text-sm text-green-700 ml-1.5">
                — {sessionEndReason.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-green-300 text-green-800 hover:bg-green-100"
            onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
          >
            View portfolio →
          </Button>
        </div>
      )}

      {/* ── Coverage map ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Coverage</CardTitle>
            {totalConfigured > 0 && (
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  coveredCount === totalConfigured
                    ? "text-green-600"
                    : "text-muted-foreground"
                )}
              >
                {coveredCount} / {totalConfigured} covered
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {configuredSkills.length === 0 && discoveredSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Waiting for the interview to begin…
            </p>
          ) : (
            configuredSkills.map((skill) => (
              <CoverageRow key={skill.id ?? skill.skill_label} skill={skill} />
            ))
          )}

          {discoveredSkills.length > 0 && (
            <>
              {configuredSkills.length > 0 && <Separator />}
              <div className="space-y-4">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Discovered during interview
                </p>
                {discoveredSkills.map((skill) => (
                  <CoverageRow
                    key={skill.id ?? skill.skill_label}
                    skill={skill}
                    discovered
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Live transcript ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Live Transcript</CardTitle>
            {totalTurns > 10 && (
              <span className="text-xs text-muted-foreground">
                Showing last 10 of {totalTurns} turns
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {transcript.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No transcript yet.</p>
          ) : (
            <div className="space-y-2">
              {totalTurns > 10 && (
                <p className="text-xs text-muted-foreground text-center pb-1 border-b">
                  ↑ Earlier turns not shown
                </p>
              )}
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

      {/* ── End session ────────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        {sessionActive ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={ending}>
                {ending ? "Ending…" : "End Session"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End the session now?</AlertDialogTitle>
                <AlertDialogDescription>
                  The interview will stop and portfolio generation will begin immediately.
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
