import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { sessionsApi } from "@/services/sessions";
import {
  ArrowLeft,
  Download,
  Search,
  Bot,
  User,
  ArrowUp,
  ArrowDown,
  FileText
} from "lucide-react";
import type { TranscriptTurn } from "@/types";

export default function TranscriptPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    Promise.all([
      sessionsApi.getTranscript(Number(sessionId)),
      sessionsApi.get(Number(sessionId)),
    ])
      .then(([tRes, sRes]) => {
        setTurns(tRes.data.turns ?? []);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  // Scroll to the turn referenced in the URL hash (e.g. #turn-12)
  useEffect(() => {
    if (turns.length === 0) return;
    const hash = location.hash;
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary", "ring-offset-2");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 3000);
      }, 100);
    }
  }, [location.hash, turns]);

  const filteredTurns = useMemo(() => {
    if (!searchQuery.trim()) return turns;
    const q = searchQuery.toLowerCase();
    return turns.filter(
      (t) =>
        t.text.toLowerCase().includes(q) ||
        (t.speaker === "ai" ? "ai interviewer" : candidateName?.toLowerCase() || "candidate").includes(q)
    );
  }, [turns, searchQuery, candidateName]);

  const handleDownload = () => {
    const lines = turns.map((t) => {
      const label = t.speaker === "ai" ? "AI Interviewer" : (candidateName || "Candidate");
      return `[Turn ${t.turn_number} - ${label}]\n${t.text}`;
    });
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-session-${sessionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-8 w-8 shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-foreground">Interview Transcript</h1>
              {turns.length > 0 && (
                <span className="bg-primary/10 text-primary border border-primary/20 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {turns.length} Turns
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {candidateName ?? `Candidate #${sessionId}`}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          {turns.length > 0 && (
            <>
              <div className="relative w-48 sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cari transkrip..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <Button variant="outline" size="sm" onClick={handleDownload} className="h-8 text-xs gap-1">
                <Download className="h-3.5 w-3.5" />
                <span>Export .txt</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="border border-destructive/40 bg-destructive/5 rounded-xl p-8 text-center text-sm text-destructive">
          Gagal memuat transkrip wawancara. Silakan muat ulang halaman.
        </div>
      ) : turns.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center bg-muted/20">
          <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm font-semibold">Belum Ada Transkrip</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            Sesi wawancara ini belum memiliki rekaman transkrip dialog.
          </p>
        </div>
      ) : (
        <Card className="shadow overflow-hidden relative">
          <CardContent className="p-0">
            {/* Scrollable Container with Custom Scrollbar */}
            <div
              ref={scrollContainerRef}
              className="max-h-[calc(100vh-230px)] min-h-[420px] overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar bg-slate-50/30 scroll-smooth"
            >
              {filteredTurns.length === 0 ? (
                <div className="text-center py-12 text-xs text-muted-foreground">
                  Tidak ada dialog yang cocok dengan kata kunci <strong>"{searchQuery}"</strong>.
                </div>
              ) : (
                filteredTurns.map((turn) => {
                  const isAI = turn.speaker === "ai";

                  return (
                    <div
                      key={turn.id}
                      id={`turn-${turn.turn_number}`}
                      className={`flex gap-3 max-w-3xl transition-all duration-300 ${
                        isAI ? "mr-auto" : "ml-auto flex-row-reverse"
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 shadow-sm ${
                          isAI
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {isAI ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      </div>

                      {/* Bubble Message */}
                      <div
                        className={`rounded-xl p-4 text-sm shadow-sm transition-all border ${
                          isAI
                            ? "bg-card border-border text-foreground"
                            : "bg-primary/10 border-primary/20 text-foreground"
                        }`}
                      >
                        {/* Speaker & Turn Meta */}
                        <div className="flex items-center justify-between gap-4 text-xs mb-1.5 pb-1 border-b border-border/40">
                          <span
                            className={`font-semibold ${
                              isAI ? "text-primary" : "text-foreground"
                            }`}
                          >
                            {isAI ? "AI Interviewer" : (candidateName || "Kandidat")}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            Turn #{turn.turn_number}
                          </span>
                        </div>

                        {/* Turn Content */}
                        <p className="whitespace-pre-wrap leading-relaxed text-sm">
                          {turn.text}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Floating Jump Navigation */}
            {filteredTurns.length > 5 && (
              <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-10">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={scrollToTop}
                  className="h-8 w-8 rounded-full shadow-md bg-background/90 backdrop-blur hover:bg-background"
                  title="Scroll to top"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={scrollToBottom}
                  className="h-8 w-8 rounded-full shadow-md bg-background/90 backdrop-blur hover:bg-background"
                  title="Scroll to bottom"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
