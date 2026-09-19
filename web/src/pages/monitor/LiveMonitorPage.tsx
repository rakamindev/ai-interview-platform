import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
import Kpi from "@/components/design/Kpi";
import SkillRow, { type SkillRowTone } from "@/components/design/SkillRow";
import BadgeDot, { type BadgeTone } from "@/components/design/BadgeDot";
import Banner from "@/components/design/Banner";
import { useCoverageWebSocket } from "@/hooks/useCoverageWebSocket";
import { sessionsApi } from "@/services/sessions";
import { COVERAGE_STATE_WIDTH } from "@/utils/constants";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MessageSquare,
  Radio,
  Square,
  Zap,
} from "lucide-react";
import type { TranscriptTurn } from "@/types";

const COVERAGE_LABEL: Record<string, string> = {
  not_yet: "Not yet",
  initiated: "Initiated",
  partial: "Partial",
  covered: "Covered",
};

const COVERAGE_BADGE_TONE: Record<string, BadgeTone> = {
  not_yet: "neutral",
  initiated: "neutral",
  partial: "warn",
  covered: "ok",
};

const COVERAGE_FILL_TONE: Record<string, SkillRowTone> = {
  not_yet: "neutral",
  initiated: "neutral",
  partial: "brand",
  covered: "brand",
};

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
  return <span className="font-mono">{mm}:{ss}</span>;
}

export default function LiveMonitorPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [assessmentName, setAssessmentName] = useState<string>("");
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const lastTurnRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = useRef(true);

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
        setCandidateName(s.candidate_name ?? null);
        setTimeLimit(s.assessment?.time_limit_min ?? null);
        setLanguage(s.assessment?.language ?? null);
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

  // Keep the transcript pinned to the newest turn unless the user scrolled up
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (el && pinnedToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  const handleTranscriptScroll = () => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    pinnedToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
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
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full rounded-[14px]" />
        <Skeleton className="h-48 w-full rounded-[14px]" />
      </div>
    );
  }

  const configuredSkills = coverageMap?.skills ?? [];
  const discoveredSkills = coverageMap?.discovered ?? [];
  const coveredCount = configuredSkills.filter((s) => s.state === "covered").length;
  const probeTotal =
    configuredSkills.reduce((sum, s) => sum + s.probe_count, 0) +
    discoveredSkills.reduce((sum, s) => sum + s.probe_count, 0);

  const liveBadge = sessionActive
    ? isConnected
      ? { tone: "live" as BadgeTone, label: "Live" }
      : { tone: "warn" as BadgeTone, label: "Reconnecting…" }
    : { tone: "neutral" as BadgeTone, label: "Completed" };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/assessments/${id}/invite`} aria-label="Back to assessment">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
              Live Monitor
            </h1>
            <BadgeDot tone={liveBadge.tone}>{liveBadge.label}</BadgeDot>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {assessmentName}
            {candidateName ? ` · ${candidateName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3.5">
          {startedAt && sessionActive && (
            <span className="inline-flex items-center gap-1.5 font-mono text-[15px] font-semibold tabular-nums text-foreground">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <ElapsedTimer startedAt={startedAt} />
            </span>
          )}
          {sessionActive ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={ending}>
                  <Square className="h-3.5 w-3.5" />
                  {ending ? "Ending..." : "End Session"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>End the session now?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The interview will stop and portfolio generation will begin. The candidate
                    can't rejoin this session.
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
              size="sm"
              onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
            >
              View portfolio →
            </Button>
          )}
        </div>
      </div>

      {/* End error */}
      {endError && <Banner tone="fail">Failed to end session. Please try again.</Banner>}

      {/* Coverage KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi
          value={coveredCount}
          unit={`/ ${configuredSkills.length} covered`}
          label="Skills with evidence"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
        <Kpi
          value={probeTotal}
          unit="probes"
          label="Follow-up questions asked"
          icon={<MessageSquare className="h-3.5 w-3.5" />}
        />
        <Kpi
          value={
            startedAt && sessionActive ? (
              <ElapsedTimer startedAt={startedAt} />
            ) : (
              <span className="font-mono">—</span>
            )
          }
          label="Elapsed"
          icon={<Clock className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="grid gap-[18px] lg:grid-cols-[1.4fr_1fr] lg:items-start">
        {/* Coverage status */}
        <div className="rounded-[14px] border border-border bg-card shadow-sm">
          <div className="flex items-start justify-between gap-3 px-5 pt-4">
            <div>
              <div className="font-display text-sm font-semibold text-foreground">
                Coverage status
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                How much of each skill has supporting evidence so far.
              </p>
            </div>
            <BadgeDot tone="neutral">
              <Radio className="h-3 w-3" /> Updating live
            </BadgeDot>
          </div>
          <div className="space-y-[18px] px-5 pb-5 pt-4">
            {configuredSkills.length === 0 && discoveredSkills.length === 0 ? (
              <p className="text-sm text-muted-foreground">Waiting for interview to begin...</p>
            ) : (
              configuredSkills.map((skill) => (
                <SkillRow
                  key={skill.id ?? skill.skill_label}
                  name={skill.skill_label}
                  meta={
                    <>
                      {skill.probe_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {skill.probe_count} probe{skill.probe_count !== 1 ? "s" : ""}
                        </span>
                      )}
                      <BadgeDot tone={COVERAGE_BADGE_TONE[skill.state] ?? "neutral"}>
                        {COVERAGE_LABEL[skill.state] ?? skill.state}
                      </BadgeDot>
                    </>
                  }
                  value={COVERAGE_STATE_WIDTH[skill.state] ?? 0}
                  tone={COVERAGE_FILL_TONE[skill.state] ?? "neutral"}
                  signal={skill.last_signal}
                />
              ))
            )}

            {discoveredSkills.length > 0 && (
              <>
                {configuredSkills.length > 0 && (
                  <hr className="border-t border-dashed border-border" />
                )}
                <div className="space-y-[18px]">
                  {discoveredSkills.map((skill) => (
                    <SkillRow
                      key={skill.id ?? skill.skill_label}
                      name={
                        <>
                          <Zap className="h-3.5 w-3.5 text-warn" />
                          {skill.skill_label}
                          <BadgeDot tone="warn">Discovered</BadgeDot>
                        </>
                      }
                      meta={
                        skill.probe_count > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {skill.probe_count} probe{skill.probe_count !== 1 ? "s" : ""}
                          </span>
                        ) : undefined
                      }
                      value={COVERAGE_STATE_WIDTH[skill.state] ?? 0}
                      tone="warn"
                      signal={skill.last_signal}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Transcript + session */}
        <div className="space-y-5">
          <div className="rounded-[14px] border border-border bg-card shadow-sm">
            <div className="px-5 pt-4">
              <div className="font-display text-sm font-semibold text-foreground mb-2">
                Live transcript
              </div>
            </div>
            <div
              ref={transcriptScrollRef}
              onScroll={handleTranscriptScroll}
              className="max-h-[46vh] space-y-2.5 overflow-y-auto px-5 pb-5 pt-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {transcript.length === 0 ? (
                <p className="text-sm text-muted-foreground">No transcript yet.</p>
              ) : (
                transcript.map((turn) => (
                  <TranscriptBubble key={turn.id} speaker={turn.speaker} text={turn.text} />
                ))
              )}
            </div>
          </div>

          <div className="rounded-[14px] border border-border bg-card shadow-sm">
            <div className="px-5 pt-4">
              <div className="font-display text-sm font-semibold text-foreground">Session</div>
            </div>
            <div className="space-y-2 px-5 pb-5 pt-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Language</span>
                <span>{language ? (language === "id" ? "Indonesian" : "English") : "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Time limit</span>
                <span className="font-mono">{timeLimit ? `${timeLimit} min` : "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Candidate</span>
                <span>{candidateName ?? "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session ended banner */}
      {sessionEnded && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center gap-3 rounded-[14px] border border-border bg-card px-5 py-4 shadow-sm"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center text-ok">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">Session ended</div>
            <p className="text-xs text-muted-foreground">
              {sessionEndReason
                ? sessionEndReason.replace(/_/g, " ")
                : "Portfolio generation will begin — about 2 minutes."}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
          >
            View portfolio
          </Button>
        </div>
      )}
    </div>
  );
}
