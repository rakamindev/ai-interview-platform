import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import LoadError from "@/components/LoadError";
import Notice from "@/components/Notice";
import PageHeader from "@/components/layout/PageHeader";
import { useCoverageWebSocket } from "@/hooks/useCoverageWebSocket";
import { sessionsApi } from "@/services/sessions";
import { copyText } from "@/utils/clipboard";
import { generateId } from "@/utils/interviewClientId";
import { interviewUrl } from "@/utils/interviewUrl";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import {
  COVERAGE_STATE_LABELS,
  COVERAGE_STATE_WIDTH,
  COVERAGE_STATE_COLOR,
} from "@/utils/constants";
import { ArrowRight, Check, Clock, Copy, Radio, UserRoundCog, Zap } from "lucide-react";
import type { CoverageSkill, TranscriptTurn } from "@/types";
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
    <span className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium tabular-nums text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
      {mm}:{ss}
    </span>
  );
}

function CoverageRow({
  skill,
  discovered = false,
}: {
  skill: CoverageSkill;
  discovered?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-1.5 font-medium">
          {discovered && <Zap className="h-3.5 w-3.5 shrink-0 text-rakamin-dark-teal" />}
          <span className="truncate">{skill.skill_label}</span>
        </span>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {skill.probe_count > 0 && (
            <span>
              {skill.probe_count} probe{skill.probe_count !== 1 ? "s" : ""}
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 capitalize">
            {COVERAGE_STATE_LABELS[skill.state]}
          </span>
        </div>
      </div>
      <Progress
        value={COVERAGE_STATE_WIDTH[skill.state]}
        indicatorClassName={discovered ? "bg-rakamin-yellow" : COVERAGE_STATE_COLOR[skill.state]}
        className="h-2"
      />
      {skill.last_signal && (
        <p className="truncate text-xs text-muted-foreground">"{skill.last_signal}"</p>
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState(false);
  const [resetStatus, setResetStatus] = useState<"idle" | "resetting" | "done">("idle");
  const [resetError, setResetError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [linkCopy, setLinkCopy] = useState<"idle" | "copied" | "failed">("idle");
  // Kept across a failed attempt so retrying cannot disconnect a candidate who has already rejoined.
  const resetIdRef = useRef<string | null>(null);
  const [sessionActive, setSessionActive] = useState(true);
  const lastTurnRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { coverageMap, sessionEnded, sessionEndReason, isConnected, connectionFailed, reconnect } =
    useCoverageWebSocket(Number(sessionId));

  // On session_ended from WS — stop polling, update local state
  useEffect(() => {
    if (sessionEnded) {
      setSessionActive(false);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
  }, [sessionEnded]);

  // Initial load
  const loadSession = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([sessionsApi.get(Number(sessionId)), sessionsApi.getTranscript(Number(sessionId))])
      .then(([sRes, tRes]) => {
        const s = sRes.data.session;
        setStartedAt(s.started_at ?? null);
        setAssessmentName(s.assessment?.name ?? "");
        setInviteUrl(s.invite_token ? interviewUrl(s) : null);
        if (s.status !== "active") setSessionActive(false);

        const turns = tRes.data.turns;
        setTranscript(turns.slice(-10));
        if (turns.length > 0) {
          lastTurnRef.current = turns[turns.length - 1].turn_number;
        }
      })
      .catch((requestError: unknown) =>
        setLoadError(
          getApiErrorStatus(requestError) === 404
            ? "This session doesn't exist or was deleted."
            : getApiErrorMessage(requestError, "Failed to load the session."),
        ),
      )
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

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
    if (!sessionActive || loading || loadError) return;
    pollTimerRef.current = setInterval(fetchNewTurns, 3000);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [sessionActive, loading, loadError, fetchNewTurns]);

  const handleCopyLink = async () => {
    if (!inviteUrl) return;
    const copied = await copyText(inviteUrl);
    setLinkCopy(copied ? "copied" : "failed");
    if (copied) setTimeout(() => setLinkCopy("idle"), 2000);
  };

  const handleResetAccess = async () => {
    resetIdRef.current ??= generateId();
    setResetStatus("resetting");
    setResetError(null);
    try {
      await sessionsApi.resetAccess(Number(sessionId), resetIdRef.current);
      resetIdRef.current = null;
      setResetStatus("done");
    } catch (error) {
      setResetStatus("idle");
      setResetError(
        getApiErrorMessage(error, "Failed to reset candidate access. Please try again."),
      );
    }
  };

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
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          backTo={`/assessments/${id}/invite`}
          backLabel="Back to assessment"
          title="Live Monitor"
        />
        <LoadError message={loadError} onRetry={loadSession} />
      </div>
    );
  }

  const configuredSkills = coverageMap?.skills ?? [];
  const discoveredSkills = coverageMap?.discovered ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        backTo={`/assessments/${id}/invite`}
        backLabel="Back to assessment"
        eyebrow="Live session"
        title="Live Monitor"
        description={assessmentName || undefined}
        actions={
          <>
            {startedAt && sessionActive && <ElapsedTimer startedAt={startedAt} />}
            {connectionFailed && !sessionEnded ? (
              <span className="flex items-center gap-2 rounded-full bg-destructive/10 py-1 pl-3 pr-1 text-xs font-medium text-destructive">
                Live updates disconnected
                <Button variant="outline" size="sm" className="h-6 px-2.5" onClick={reconnect}>
                  Reconnect
                </Button>
              </span>
            ) : (
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                  isConnected
                    ? "bg-green-50 text-green-800"
                    : "bg-rakamin-yellow/25 text-rakamin-charcoal",
                )}
              >
                <Radio className="h-3.5 w-3.5" />
                {isConnected ? "Live" : "Reconnecting..."}
              </span>
            )}
          </>
        }
      />

      {/* Session ended banner */}
      {sessionEnded && (
        <Notice
          variant="success"
          title="Session ended"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
            >
              View portfolio <ArrowRight />
            </Button>
          }
        >
          {sessionEndReason && sessionEndReason.replace(/_/g, " ")}
        </Notice>
      )}

      {/* Coverage map */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Coverage Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 px-5 pb-5">
          {configuredSkills.length === 0 && discoveredSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">Waiting for interview to begin...</p>
          ) : (
            configuredSkills.map((skill) => (
              <CoverageRow key={skill.id ?? skill.skill_label} skill={skill} />
            ))
          )}

          {/* Discovered skills */}
          {discoveredSkills.length > 0 && (
            <div className="space-y-4 border-t pt-5">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-rakamin-teal">
                Discovered
              </p>
              {discoveredSkills.map((skill) => (
                <CoverageRow key={skill.id ?? skill.skill_label} skill={skill} discovered />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live transcript */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Live Transcript</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {transcript.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transcript yet.</p>
          ) : (
            <div className="space-y-2">
              {transcript.map((turn) => (
                <TranscriptBubble
                  key={turn.id}
                  speaker={turn.speaker}
                  text={turn.text}
                  candidateLabel="Candidate"
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {endError && <Notice variant="error">Failed to end session. Please try again.</Notice>}
      {resetStatus === "done" && (
        <Notice variant="success">
          Candidate access reset. Ask the candidate to open their invite link now in a different
          browser or device; the session ends if nobody rejoins within 2 minutes of the connection
          being lost.
        </Notice>
      )}
      {resetError && <Notice variant="error">{resetError}</Notice>}
      {linkCopy === "failed" && inviteUrl && (
        <Notice variant="error">
          Couldn't copy the link. Copy it manually:{" "}
          <span className="break-all font-medium">{inviteUrl}</span>
        </Notice>
      )}

      {/* End Session */}
      <div className="flex flex-wrap justify-end gap-2">
        {sessionActive && inviteUrl && (
          <Button variant="ghost" onClick={handleCopyLink}>
            {linkCopy === "copied" ? <Check /> : <Copy />}
            {linkCopy === "copied" ? "Copied" : "Copy invite link"}
          </Button>
        )}
        {sessionActive && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={resetStatus === "resetting"}>
                <UserRoundCog />
                {resetStatus === "resetting" ? "Resetting..." : "Reset candidate access"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset candidate access?</AlertDialogTitle>
                <AlertDialogDescription>
                  Use this when the candidate switched device or cleared their browser data and
                  cannot rejoin. Their current browser is disconnected within a few seconds and can
                  no longer rejoin. The next browser to open the invite link takes over, so confirm
                  first that you are talking to the candidate. Resetting does not add time: the
                  session still ends 2 minutes after the connection was lost.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetAccess}>Reset access</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
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
            View portfolio <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}
