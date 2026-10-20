import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionsApi } from "@/services/sessions";
import { showRequestError } from "@/lib/requestToast";
import { ArrowLeft, Download, FileText, Search } from "lucide-react";
import type { TranscriptTurn } from "@/types";

type SpeakerFilter = "all" | "ai" | "candidate";

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [speaker, setSpeaker] = useState<SpeakerFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([sessionsApi.getTranscript(Number(sessionId)), sessionsApi.get(Number(sessionId))])
      .then(([transcriptResponse, sessionResponse]) => {
        setTurns(transcriptResponse.data.turns);
        setCandidateName((sessionResponse.data as any).session?.candidate_name ?? (sessionResponse as any).session?.candidate_name ?? (sessionResponse.data as any).candidate_name ?? null);
      })
      .catch((requestError) => {
        setError(true);
        showRequestError(requestError, "Couldn’t load the transcript.");
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  const filteredTurns = useMemo(() => {
    const query = search.trim().toLowerCase();
    return turns.filter((turn) => {
      const speakerMatches = speaker === "all" || turn.speaker === speaker;
      const textMatches = !query || turn.text.toLowerCase().includes(query);
      return speakerMatches && textMatches;
    });
  }, [search, speaker, turns]);

  const handleDownload = () => {
    const lines = turns.map((turn) => `[${turn.speaker === "ai" ? "AI" : "Candidate"}]\\n${turn.text}`);
    const blob = new Blob([lines.join("\\n\\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `transcript-session-${sessionId}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Link to={`/assessments/${id}/sessions/${sessionId}/portfolio`} aria-label="Back to portfolio" className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-muted-foreground hover:bg-muted"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="min-w-0"><Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary"><FileText className="mr-1.5 h-3 w-3" />Interview evidence</Badge><h1 className="mt-2 truncate text-2xl font-semibold tracking-tight sm:text-3xl">Interview Transcript</h1><p className="mt-1 truncate text-sm text-muted-foreground">{candidateName ?? "Interview candidate"} · Session #{sessionId}</p></div>
        </div>
        {!loading && !error && turns.length > 0 && <Button variant="outline" className="h-11" onClick={handleDownload}><Download className="h-4 w-4" /> Download .txt</Button>}
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/70 px-5 py-5 sm:px-7">
          <CardTitle className="text-xl">Search the conversation</CardTitle>
          <p className="text-sm text-muted-foreground">Find the evidence span you need without losing speaker context.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:p-7">
          <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transcript text" aria-label="Search transcript text" className="h-11 pl-9" /></div>
          <Select value={speaker} onValueChange={(value) => setSpeaker(value as SpeakerFilter)}><SelectTrigger className="h-11 w-full sm:w-44" aria-label="Filter transcript speaker"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All speakers</SelectItem><SelectItem value="candidate">Candidate</SelectItem><SelectItem value="ai">AI interviewer</SelectItem></SelectContent></Select>
        </CardContent>
      </Card>

      {loading ? <div className="space-y-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-24 w-full rounded-2xl" />)}</div> : error ? (
        <div className="flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/5 p-5" role="alert"><div><p className="font-medium text-destructive">Failed to load transcript. Please refresh.</p><p className="mt-1 text-sm text-muted-foreground">Retry the page to request it again.</p></div><Button variant="outline" onClick={() => window.location.reload()}>Retry</Button></div>
      ) : filteredTurns.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center"><FileText className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">No transcript available for this session.</p><p className="mt-1 text-sm text-muted-foreground">Transcript evidence will appear when the session produces turns.</p></div>
      ) : (
        <div role="log" aria-label="Interview transcript" className="space-y-3">
          {filteredTurns.map((turn) => {
            const isAI = turn.speaker === "ai";
            return <div key={turn.id} className={`rounded-2xl border p-5 shadow-sm ${isAI ? "border-border/80 bg-muted/30" : "border-primary/15 bg-background"}`}><div className="mb-3 flex items-center justify-between gap-3"><Badge variant={isAI ? "secondary" : "outline"}>{isAI ? "AI Interviewer" : "Candidate"}</Badge><span className="text-xs tabular-nums text-muted-foreground">Turn {turn.turn_number}</span></div><p className="whitespace-pre-wrap text-sm leading-7">{turn.text}</p></div>;
          })}
        </div>
      )}
    </div>
  );
}
