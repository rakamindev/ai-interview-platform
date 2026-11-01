import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { sessionsApi } from "@/services/sessions";
import PrivacyBadge from "@/components/common/PrivacyBadge";
import {
  ArrowLeft,
  Download,
  Search,
  Bot,
  User,
  ShieldCheck,
  FileText,
  AlertCircle
} from "lucide-react";
import type { TranscriptTurn } from "@/types";

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState<"all" | "ai" | "candidate">("all");

  useEffect(() => {
    Promise.all([
      sessionsApi.getTranscript(Number(sessionId)),
      sessionsApi.get(Number(sessionId)),
    ])
      .then(([tRes, sRes]) => {
        setTurns(tRes.data.turns || []);
        setCandidateName(sRes.data.session?.candidate_name ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleDownload = () => {
    const lines = turns.map((t) => {
      const label = t.speaker === "ai" ? "AI Interviewer" : (candidateName || "Candidate");
      return `[${label} - Turn ${t.turn_number}]\n${t.text}`;
    });
    const header = `=== INTERVIEW TRANSCRIPT (SESSION #${sessionId}) ===\nCandidate: ${candidateName || "Anonymous"}\nCompliance: UU PDP No. 27/2022 Verified\nGenerated: ${new Date().toISOString()}\n\n`;
    const blob = new Blob([header + lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-session-${sessionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredTurns = useMemo(() => {
    return turns.filter((turn) => {
      const matchesSearch = turn.text.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (speakerFilter === "ai") return turn.speaker === "ai";
      if (speakerFilter === "candidate") return turn.speaker === "candidate";
      return true;
    });
  }, [turns, searchQuery, speakerFilter]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="mt-1 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Interview Transcript Record
              </h1>
              <PrivacyBadge />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="font-semibold text-foreground">
                {candidateName || `Session #${sessionId}`}
              </span>
              <span>·</span>
              <span>{turns.length} dialogue turns recorded</span>
            </div>
          </div>
        </div>

        {!loading && !error && turns.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="h-8 text-xs font-medium shadow-2xs self-start sm:self-auto"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            Download Sanitized .txt
          </Button>
        )}
      </div>

      {/* UU PDP Banner */}
      <PrivacyBadge variant="banner" />

      {/* Search and Filters */}
      {!loading && !error && turns.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search in transcript text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <div className="flex bg-muted/60 p-0.5 rounded-lg border text-xs">
            <button
              onClick={() => setSpeakerFilter("all")}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                speakerFilter === "all" ? "bg-background shadow-2xs font-bold text-foreground" : "text-muted-foreground"
              }`}
            >
              All ({turns.length})
            </button>
            <button
              onClick={() => setSpeakerFilter("candidate")}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                speakerFilter === "candidate" ? "bg-background shadow-2xs font-bold text-primary" : "text-muted-foreground"
              }`}
            >
              Candidate ({turns.filter((t) => t.speaker === "candidate").length})
            </button>
            <button
              onClick={() => setSpeakerFilter("ai")}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                speakerFilter === "ai" ? "bg-background shadow-2xs font-bold text-foreground" : "text-muted-foreground"
              }`}
            >
              AI ({turns.filter((t) => t.speaker === "ai").length})
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border rounded-xl p-4 space-y-2">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex items-center gap-3 border border-destructive/40 bg-destructive/5 rounded-xl p-6 text-xs text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <h4 className="font-bold">Failed to load transcript session</h4>
            <p className="text-muted-foreground mt-0.5">Please refresh or verify API connectivity.</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && turns.length === 0 && (
        <div className="border border-dashed rounded-2xl p-12 text-center space-y-2 bg-muted/10">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold">No transcript recorded yet</p>
          <p className="text-xs text-muted-foreground">
            Transcripts will automatically stream here once the candidate begins the live interview.
          </p>
        </div>
      )}

      {/* Turns Feed with Line-Clamping & Overflow Prevention */}
      {!loading && !error && turns.length > 0 && (
        <div className="space-y-3">
          {filteredTurns.length === 0 ? (
            <div className="border border-dashed rounded-xl p-8 text-center text-xs text-muted-foreground">
              No dialogue turns match "{searchQuery}".
            </div>
          ) : (
            filteredTurns.map((turn) => {
              const isAI = turn.speaker === "ai";

              return (
                <div
                  key={turn.id}
                  className={`rounded-xl p-4 transition-colors border shadow-2xs ${
                    isAI
                      ? "bg-muted/40 border-border/80"
                      : "bg-background border-primary/20 hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex items-center justify-center w-6 h-6 rounded-md text-xs ${
                          isAI
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/10 text-primary font-semibold"
                        }`}
                      >
                        {isAI ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                      </div>
                      <span
                        className={`text-xs font-bold ${
                          isAI ? "text-muted-foreground" : "text-primary"
                        }`}
                      >
                        {isAI ? "AI Interviewer" : (candidateName || "Candidate")}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-muted-foreground">
                      Turn #{turn.turn_number}
                    </span>
                  </div>

                  {/* Text wrapping: break-words, overflow-wrap, whitespace-pre-wrap prevent any overflow */}
                  <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words overflow-hidden">
                    {turn.text}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
