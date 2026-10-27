import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Radio,
  Zap,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  BarChart3,
  Bot,
  User,
  ExternalLink,
  Layers,
  Flame,
} from "lucide-react";
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
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-slate-100 font-mono text-xs font-semibold tracking-wider shadow-inner">
      <Clock className="h-3.5 w-3.5 text-teal-400 animate-pulse" />
      <span>{mm}:{ss}</span>
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
  const [viewMode, setViewMode] = useState<"recent" | "all">("recent");
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const lastTurnRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcript.length > 0) {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [transcript]);

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
        setAssessmentName(s.assessment?.name ?? "Assessment Session");
        setCandidateName(s.candidate_name || `Candidate #${sessionId}`);
        if (s.status !== "active") setSessionActive(false);

        const turns = tRes.data.turns;
        setTranscript(turns);
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
        setTranscript((prev) => [...prev, ...res.data.turns]);
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
      <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-5 h-96 rounded-2xl" />
          <Skeleton className="lg:col-span-7 h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  const configuredSkills = coverageMap?.skills ?? [];
  const discoveredSkills = coverageMap?.discovered ?? [];
  const totalSkills = configuredSkills.length + discoveredSkills.length;
  const probedSkillsCount = [...configuredSkills, ...discoveredSkills].filter(
    (s) => s.state !== "not_yet"
  ).length;
  const overallCoveragePct = totalSkills > 0 ? Math.round((probedSkillsCount / totalSkills) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Cockpit Header */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                to={`/assessments/${id}/invite`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 px-2.5 py-1 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Kembali ke Sessions
              </Link>
              <span className="text-slate-300">/</span>
              <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-xs py-0.5">
                <Activity className="h-3 w-3 mr-1 text-teal-600 animate-pulse" />
                Live Monitoring Cockpit
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 pt-1">
              {assessmentName}
            </h1>
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <span>Candidate: <strong className="text-slate-700">{candidateName}</strong></span>
              <span>•</span>
              <span>Session ID: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">#{sessionId}</code></span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Live Connection Badge */}
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border",
              isConnected
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            )}>
              <span className="relative flex h-2 w-2">
                {isConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  isConnected ? "bg-emerald-500" : "bg-amber-500"
                )}></span>
              </span>
              <span>{isConnected ? "Live Telemetry" : "Reconnecting..."}</span>
            </div>

            {/* Elapsed Timer */}
            {startedAt && sessionActive && <ElapsedTimer startedAt={startedAt} />}

            {/* End Session Button or View Report */}
            {sessionActive ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="rounded-xl shadow-sm text-xs font-semibold h-9" disabled={ending}>
                    <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                    {ending ? "Mengakhiri..." : "Hentikan Interview"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
                      <AlertTriangle className="h-5 w-5" />
                      Konfirmasi Hentikan Sesi Interview?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-600 text-sm">
                      Sesi wawancara kandidat akan segera ditutup. AI Engine akan langsung memproses seluruh rekaman transkrip dan menghasilkan Skill Portfolio &amp; Fit-Gap Report secara otomatis via Sidekiq.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Batalkan</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleEndSession}
                      className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
                    >
                      Hentikan &amp; Generate Portfolio
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold h-9 shadow-sm"
                onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
              >
                Lihat Portfolio AI →
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Session Ended Banner */}
      {sessionEnded && (
        <div className="flex items-center justify-between p-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-900">Sesi Wawancara Selesai</p>
              <p className="text-xs text-emerald-700">
                {sessionEndReason ? `Alasan: ${sessionEndReason.replace(/_/g, " ")}` : "Wawancara telah rampung dan siap dievaluasi."}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs shadow-sm"
            onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
          >
            Buka Portfolio &amp; Fit-Gap Report →
          </Button>
        </div>
      )}

      {/* Cockpit KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Coverage Depth</p>
              <p className="text-xl font-bold text-slate-900">{overallCoveragePct}%</p>
              <p className="text-[11px] text-teal-600 font-medium">{probedSkillsCount} dari {totalSkills} skill teruji</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Dialogue Turns</p>
              <p className="text-xl font-bold text-slate-900">{transcript.length}</p>
              <p className="text-[11px] text-slate-500">Pertukaran respon</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Skills Ditemukan</p>
              <p className="text-xl font-bold text-slate-900">{discoveredSkills.length}</p>
              <p className="text-[11px] text-amber-600 font-medium">Autonomous discovery</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Audit &amp; UU PDP</p>
              <p className="text-sm font-bold text-slate-900">Compliant</p>
              <p className="text-[11px] text-indigo-600 font-medium">Auto-redacted audio</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Cockpit Split: Left Coverage Matrix, Right Dialogue Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Coverage Matrix */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-600" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Target Skill Coverage
                </CardTitle>
              </div>
              <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600">
                {configuredSkills.length} configured
              </Badge>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 max-h-[560px] overflow-y-auto">
              {configuredSkills.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <Bot className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  Menunggu inisialisasi AI interviewer...
                </div>
              ) : (
                configuredSkills.map((skill) => (
                  <div
                    key={skill.id ?? skill.skill_label}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {skill.skill_label}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {skill.probe_count > 0 && (
                          <span className="text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded font-mono font-medium">
                            {skill.probe_count} probe{skill.probe_count !== 1 ? "s" : ""}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] uppercase tracking-wider font-semibold py-0 px-1.5",
                            skill.state === "covered" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                            skill.state === "partial" && "bg-teal-50 text-teal-700 border-teal-200",
                            skill.state === "initiated" && "bg-sky-50 text-sky-700 border-sky-200",
                            skill.state === "not_yet" && "bg-slate-100 text-slate-500 border-slate-200"
                          )}
                        >
                          {COVERAGE_STATE_LABELS[skill.state] || skill.state}
                        </Badge>
                      </div>
                    </div>

                    <Progress
                      value={COVERAGE_STATE_WIDTH[skill.state]}
                      indicatorClassName={COVERAGE_STATE_COLOR[skill.state]}
                      className="h-1.5 bg-slate-200"
                    />

                    {skill.last_signal && (
                      <p className="text-[11px] text-slate-500 italic bg-white border border-slate-100 p-2 rounded-lg line-clamp-2">
                        "{skill.last_signal}"
                      </p>
                    )}
                  </div>
                ))
              )}

              {/* Autonomous Discovered Skills */}
              {discoveredSkills.length > 0 && (
                <div className="pt-3 border-t border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                    <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                    <span>Discovered Skills (AI Detected)</span>
                  </div>
                  {discoveredSkills.map((skill) => (
                    <div
                      key={skill.id ?? skill.skill_label}
                      className="p-3 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-amber-900 truncate">
                          {skill.skill_label}
                        </span>
                        <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded font-mono">
                          {skill.probe_count} probes
                        </span>
                      </div>
                      <Progress
                        value={COVERAGE_STATE_WIDTH[skill.state]}
                        indicatorClassName="bg-amber-500"
                        className="h-1.5 bg-amber-100"
                      />
                      {skill.last_signal && (
                        <p className="text-[11px] text-amber-900 italic bg-white/80 p-2 rounded-lg border border-amber-100 line-clamp-2">
                          "{skill.last_signal}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Transcript Stream */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white overflow-hidden flex flex-col h-full max-h-[640px]">
            <CardHeader className="p-4 pb-3 border-b border-slate-100 flex flex-row items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-teal-600 animate-pulse" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Live Transcript Stream ({transcript.length} turns)
                </CardTitle>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <Button
                  type="button"
                  variant={viewMode === "recent" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-6 px-2.5 text-xs rounded-lg font-medium",
                    viewMode === "recent" && "bg-white shadow-xs text-slate-900"
                  )}
                  onClick={() => setViewMode("recent")}
                >
                  Recent (10)
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "all" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-6 px-2.5 text-xs rounded-lg font-medium",
                    viewMode === "all" && "bg-white shadow-xs text-slate-900"
                  )}
                  onClick={() => setViewMode("all")}
                >
                  Full Log
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4 overflow-y-auto space-y-3 flex-1 bg-slate-50/40 custom-scrollbar scroll-smooth">
              {transcript.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 mb-3">
                    <Activity className="h-6 w-6 animate-pulse" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">Menunggu transkrip pembicaraan...</p>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    AI Interviewer sedang membuka sesi dan menyapa kandidat. Percakapan akan tampil otomatis di sini secara real-time.
                  </p>
                </div>
              ) : (
                <>
                  {(viewMode === "recent" ? transcript.slice(-10) : transcript).map((turn) => (
                    <div
                      key={turn.id}
                      className={cn(
                        "p-3.5 rounded-2xl border transition-all text-sm",
                        turn.speaker === "ai"
                          ? "bg-teal-50/40 border-teal-100/80 mr-6"
                          : "bg-white border-slate-200/80 ml-6 shadow-xs"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className={cn(
                            "w-5 h-5 rounded-md flex items-center justify-center text-[10px]",
                            turn.speaker === "ai" ? "bg-teal-600 text-white" : "bg-slate-800 text-white"
                          )}>
                            {turn.speaker === "ai" ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          </div>
                          <span className="text-xs font-bold text-slate-800">
                            {turn.speaker === "ai" ? "Rakamin AI Interviewer" : candidateName}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Turn #{turn.turn_number}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap pl-6">
                        {turn.text}
                      </p>
                    </div>
                  ))}
                  <div ref={transcriptEndRef} className="h-px w-full" aria-hidden="true" />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {endError && (
        <div className="border border-rose-200 bg-rose-50 rounded-2xl p-4 text-xs font-medium text-rose-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>Gagal menghentikan sesi secara otomatis. Mohon periksa koneksi atau coba kembali beberapa saat lagi.</span>
        </div>
      )}
    </div>
  );
}
