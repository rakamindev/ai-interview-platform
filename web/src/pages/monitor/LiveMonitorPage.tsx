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
import { ArrowLeft, CheckCircle2, Clock, Radio, Zap, ShieldAlert } from "lucide-react";
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
    <span className="flex items-center gap-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-xl bg-muted/60 text-foreground border border-border/60 shadow-sm">
      <Clock className="h-3.5 w-3.5 text-primary" />
      {mm}:{ss}
    </span>
  );
}

export default function LiveMonitorPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [assessmentName, setAssessmentName] = useState<string>("");
  const [candidateName, setCandidateName] = useState<string>("");
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const lastTurnRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { coverageMap, sessionEnded, sessionEndReason, isConnected } =
    useCoverageWebSocket(Number(sessionId));

  // On session_ended from WS
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
        setCandidateName(s.candidate_name ?? "");
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
      // transient poll failure
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
      <div className="max-w-3xl mx-auto space-y-4 py-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  const configuredSkills = coverageMap?.skills ?? [];
  const discoveredSkills = coverageMap?.discovered ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-card border border-border/80 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to={`/assessments/${id}/invite`}
            className="p-2.5 rounded-xl bg-muted/60 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">Pemantauan Sesi Langsung</h1>
              <span className={cn(
                "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                isConnected
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              )}>
                <Radio className="h-3 w-3 animate-pulse" />
                {isConnected ? "Live Stream" : "Menghubungkan..."}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {candidateName ? `Kandidat: ${candidateName}` : assessmentName || "Live Interview Monitor"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {startedAt && sessionActive && <ElapsedTimer startedAt={startedAt} />}
          {sessionActive && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={ending}
                  className="rounded-xl text-xs font-semibold shadow-sm"
                >
                  {ending ? "Mengakhiri..." : "Akhiri Sesi"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-foreground">Akhiri sesi wawancara sekarang?</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground text-xs">
                    Wawancara suara kandidat akan dihentikan dan sistem segera memulai proses evaluasi portofolio AI.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleEndSession}
                    className="rounded-xl bg-destructive text-destructive-foreground font-semibold"
                  >
                    Ya, Akhiri Sesi
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Session ended banner */}
      {sessionEnded && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <div>
              <span className="font-bold text-sm text-foreground">Sesi Wawancara Selesai</span>
              {sessionEndReason && (
                <span className="text-xs text-muted-foreground ml-1.5">
                  ({sessionEndReason.replace(/_/g, " ")})
                </span>
              )}
            </div>
          </div>
          <Button
            size="sm"
            className="rounded-xl bg-primary text-primary-foreground font-semibold text-xs ml-auto"
            onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
          >
            Buka Portofolio Hasil Evaluasi
          </Button>
        </div>
      )}

      {/* Coverage status card */}
      <Card className="rounded-2xl border border-border/80 bg-card shadow-sm">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-sm font-bold text-foreground flex items-center justify-between">
            <span>Cakupan Kompetensi Real-Time</span>
            <span className="text-xs font-normal text-muted-foreground">
              {configuredSkills.length} keahlian terdaftar
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {configuredSkills.length === 0 && discoveredSkills.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">Menunggu sesi wawancara dimulai...</p>
          ) : (
            configuredSkills.map((skill) => (
              <div key={skill.id ?? skill.skill_label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{skill.skill_label}</span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {skill.probe_count > 0 && (
                      <span className="font-mono">{skill.probe_count} probe</span>
                    )}
                    <span className="font-medium capitalize">{COVERAGE_STATE_LABELS[skill.state]}</span>
                  </div>
                </div>
                <Progress
                  value={COVERAGE_STATE_WIDTH[skill.state]}
                  indicatorClassName={COVERAGE_STATE_COLOR[skill.state]}
                  className="h-2 rounded-full bg-muted"
                />
                {skill.last_signal && (
                  <p className="text-[11px] text-muted-foreground italic truncate">
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
              <div className="space-y-3 pt-1">
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Keahlian Tambahan yang Terdeteksi
                </p>
                {discoveredSkills.map((skill) => (
                  <div key={skill.id ?? skill.skill_label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        {skill.skill_label}
                      </span>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {skill.probe_count > 0 && (
                          <span className="font-mono">{skill.probe_count} probe</span>
                        )}
                        <span className="font-medium capitalize">{COVERAGE_STATE_LABELS[skill.state]}</span>
                      </div>
                    </div>
                    <Progress
                      value={COVERAGE_STATE_WIDTH[skill.state]}
                      indicatorClassName="bg-amber-500"
                      className="h-2 rounded-full bg-muted"
                    />
                    {skill.last_signal && (
                      <p className="text-[11px] text-muted-foreground italic truncate">
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

      {/* Live transcript feed */}
      <Card className="rounded-2xl border border-border/80 bg-card shadow-sm">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-sm font-bold text-foreground">Transkrip Langsung</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {transcript.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Belum ada percakapan terekam.</p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {transcript.map((turn) => (
                <TranscriptBubble key={turn.id} speaker={turn.speaker} text={turn.text} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {endError && (
        <div className="border border-destructive/30 bg-destructive/10 rounded-2xl p-3 text-xs text-destructive flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          <span>Gagal mengakhiri sesi. Silakan coba lagi.</span>
        </div>
      )}
    </div>
  );
}
