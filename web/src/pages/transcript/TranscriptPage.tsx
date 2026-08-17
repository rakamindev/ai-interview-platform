import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sessionsApi } from "@/services/sessions";
import { ArrowLeft, Download, FileJson } from "lucide-react";
import type { TranscriptTurn } from "@/types";
import { cn } from "@/lib/utils";

function formatTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDuration(turn: TranscriptTurn): string | null {
  if (!turn.audio_start_ms || !turn.audio_end_ms) return null;
  const ms = turn.audio_end_ms - turn.audio_start_ms;
  if (ms <= 0) return null;
  const secs = Math.round(ms / 1000);
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;
  const parts = text.split(new RegExp(`(${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark key={i} className="bg-amber-200 rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [searchParams] = useSearchParams();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [speakerFilter, setSpeakerFilter] = useState<"all" | "ai" | "candidate">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedTurn, setHighlightedTurn] = useState<number | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const anchorTurn = useMemo(() => {
    const raw = searchParams.get("turn");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  }, [searchParams]);

  useEffect(() => {
    Promise.all([sessionsApi.getTranscript(Number(sessionId)), sessionsApi.get(Number(sessionId))])
      .then(([tRes, sRes]) => {
        setTurns(tRes.data.turns);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (!anchorTurn || loading || turns.length === 0) return;
    const target = document.getElementById(`turn-${anchorTurn}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedTurn(anchorTurn);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedTurn(null), 3000);
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, [anchorTurn, loading, turns]);

  const visibleTurns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return turns.filter((t) => {
      if (speakerFilter !== "all" && t.speaker !== speakerFilter) return false;
      if (q && !t.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [turns, speakerFilter, searchQuery]);

  const handleDownloadTxt = () => {
    const lines = turns.map((t) => {
      const label = t.speaker === "ai" ? "AI" : "Candidate";
      const time = formatTime(t.ts ?? t.created_at);
      return `[${label}${time ? ` @ ${time}` : ""}]\n${t.text}`;
    });
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-session-${sessionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const data = turns.map((t) => ({
      id: t.id,
      turn_number: t.turn_number,
      speaker: t.speaker,
      text: t.text,
      ts: t.ts ?? t.created_at,
      audio_start_ms: t.audio_start_ms ?? null,
      audio_end_ms: t.audio_end_ms ?? null,
    }));
    const blob = new Blob([JSON.stringify({ session_id: sessionId, turns: data }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-session-${sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Interview Transcript</h1>
            {candidateName && <p className="text-sm text-muted-foreground">{candidateName}</p>}
          </div>
        </div>
        {!loading && !error && turns.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadTxt}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              .txt
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadJson}>
              <FileJson className="h-3.5 w-3.5 mr-1.5" />
              .json
            </Button>
          </div>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="border rounded-lg p-6 text-center text-sm text-destructive">
          Failed to load transcript. Please refresh.
        </div>
      )}

      {!loading && !error && turns.length === 0 && (
        <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
          No transcript available for this session.
        </div>
      )}

      {!loading && !error && turns.length > 0 && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-2">
            <Select
              value={speakerFilter}
              onValueChange={(v) => setSpeakerFilter(v as "all" | "ai" | "candidate")}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All speakers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All speakers</SelectItem>
                <SelectItem value="ai">AI Interviewer</SelectItem>
                <SelectItem value="candidate">Candidate</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transcript..."
              className="flex-1"
              aria-label="Search transcript"
            />
          </div>

          {visibleTurns.length === 0 && (
            <p className="text-sm text-muted-foreground">No turns match the current filter.</p>
          )}

          <div className="space-y-3">
            {visibleTurns.map((turn) => {
              const isAI = turn.speaker === "ai";
              const time = formatTime(turn.ts ?? turn.created_at);
              const duration = formatDuration(turn);
              const isHighlighted = turn.turn_number === highlightedTurn;
              return (
                <div
                  key={turn.id}
                  id={`turn-${turn.turn_number}`}
                  className={cn(
                    "rounded-lg p-4 transition-shadow",
                    isAI ? "bg-muted border" : "bg-background border border-primary/20",
                    isHighlighted && "ring-2 ring-primary shadow-lg",
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p
                      className={cn(
                        "text-xs font-semibold",
                        isAI ? "text-muted-foreground" : "text-primary",
                      )}
                    >
                      {isAI ? "AI Interviewer" : "Candidate"}
                      <span className="text-muted-foreground/70 font-normal ml-2">
                        Turn {turn.turn_number}
                      </span>
                    </p>
                    {(time || duration) && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {time}
                        {duration && <span className="ml-1.5">({duration})</span>}
                      </p>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">
                    <HighlightedText text={turn.text} query={searchQuery} />
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
