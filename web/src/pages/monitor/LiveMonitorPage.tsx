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
import HeroBanner from "@/components/common/HeroBanner";
import RakaminSpinner from "@/components/common/RakaminSpinner";

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
      <div className="max-w-4xl mx-auto py-12">
        <RakaminSpinner text="Menghubungkan ke live monitor session..." size="lg" />
      </div>
    );
  }

  const configuredSkills = coverageMap?.skills ?? [];
  const discoveredSkills = coverageMap?.discovered ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4 pb-12">
      {/* Hero Banner */}
      <HeroBanner
        badgeText="⭐️ Real-Time AI Interview Observer"
        title="Live Session Monitor & Signal Tracker"
        highlightText="Real-Time WebSocket"
        subtitle="Pantau progres wawancara kandidat secara real-time, visualisasi 4-level coverage state, dan amati transkrip percakapan langsung."
        bulletPoints={[
          "Sinkronisasi status coverage B7 secara instan via WebSocket",
          "Indikator konektivitas live candidate audio channel",
          "Opsi emergency termination dengan konfirmasi asesor",
        ]}
        primaryAction={
          sessionEnded
            ? {
                label: "Lihat Portfolio Kandidat",
                onClick: () => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`),
              }
            : undefined
        }
        secondaryAction={{
          label: "Kembali ke Sesi",
          onClick: () => navigate(`/assessments/${id}/invite`),
          icon: <ArrowLeft className="h-4 w-4 mr-1.5" />,
        }}
        imageSrc="/images/interview.png"
        imageAlt="Rakamin Live Interview Monitor"
        imageFloatingBadge={{
          title: "Live Streaming",
          subtitle: "Zero Latency WebSocket",
        }}
      />

      {/* Header */}
      <div className="flex items-start justify-between pb-2 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/invite`}
              className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Live Monitor Session
            </h2>
          </div>
          {assessmentName && (
            <p className="text-xs text-slate-500 pl-6">Assessment: <span className="font-semibold text-slate-700">{assessmentName}</span></p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {startedAt && sessionActive && <ElapsedTimer startedAt={startedAt} />}
          <span className={cn(
            "flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full",
            isConnected ? "text-emerald-700 bg-emerald-50 border border-emerald-200" : "text-amber-700 bg-amber-50 border border-amber-200"
          )}>
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            {isConnected ? "Koneksi Live Aktif" : "Menghubungkan Ulang..."}
          </span>
        </div>
      </div>

      {/* Session ended banner */}
      {sessionEnded && (
        <div className="flex items-center gap-3 text-sm bg-teal-50/80 border border-teal-200 rounded-2xl px-5 py-4">
          <CheckCircle className="h-5 w-5 text-[#01959f] shrink-0" />
          <div>
            <span className="font-bold text-slate-900">Sesi Wawancara Telah Berakhir</span>
            {sessionEndReason && (
              <span className="text-slate-500 ml-1.5 text-xs">
                — {sessionEndReason.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="cta"
            className="ml-auto rounded-xl shadow-xs text-xs"
            onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
          >
            Lihat Portfolio →
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
                  <p className="text-xs text-muted-foreground truncate">
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
