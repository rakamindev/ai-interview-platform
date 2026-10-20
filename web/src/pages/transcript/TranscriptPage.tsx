import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
import { sessionsApi } from "@/services/sessions";
import { ArrowLeft, Download, Search, MessageSquareOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/types";

type SpeakerFilter = "all" | "ai" | "candidate";

const SPEAKER_FILTERS: { value: SpeakerFilter; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "candidate", label: "Candidate" },
  { value: "ai", label: "AI interviewer" },
];

function formatTime(iso?: string) {
  if (!iso) return undefined;
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(seconds?: number) {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes} min ${rest} s` : `${rest} s`;
}

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | undefined>(undefined);
  const [startedAt, setStartedAt] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [speaker, setSpeaker] = useState<SpeakerFilter>("all");

  const load = () => {
    setLoading(true);
    setError(false);
    Promise.all([
      sessionsApi.getTranscript(Number(sessionId)),
      sessionsApi.get(Number(sessionId)),
    ])
      .then(([tRes, sRes]) => {
        setTurns(tRes.data.turns);
        setCandidateName(sRes.data.session.candidate_name ?? null);
        setDurationSeconds(sRes.data.session.duration_seconds);
        setStartedAt(sRes.data.session.started_at);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, [sessionId]);

  const aiCount = useMemo(() => turns.filter((t) => t.speaker === "ai").length, [turns]);
  const candidateCount = turns.length - aiCount;

  const visibleTurns = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return turns.filter((turn) => {
      if (speaker !== "all" && turn.speaker !== speaker) return false;
      if (!needle) return true;
      return turn.text.toLowerCase().includes(needle);
    });
  }, [turns, query, speaker]);

  const handleDownload = () => {
    const lines = turns.map((turn) => {
      const label = turn.speaker === "ai" ? "AI interviewer" : "Candidate";
      const time = formatTime(turn.created_at);
      return `[${time ?? "turn " + turn.turn_number}] ${label}\n${turn.text}`;
    });
    const header = [
      "Interview transcript",
      candidateName ? `Candidate: ${candidateName}` : null,
      `Turns: ${turns.length}`,
      "",
    ].filter(Boolean);
    const blob = new Blob([[...header, ...lines].join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-session-${sessionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-5 border-b pb-6">
        <Link
          to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
          className="inline-flex min-h-11 items-center gap-2 rounded-md pr-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Candidate results
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">Interview transcript</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {[
                candidateName ? `${candidateName}'s conversation with the AI interviewer` : "The full conversation between the candidate and the AI interviewer",
                startedAt ? `held on ${new Date(startedAt).toLocaleDateString()}` : null,
              ].filter(Boolean).join(", ")}
            </p>
          </div>
          {turns.length > 0 && (
            <Button variant="outline" className="min-h-11 sm:shrink-0" onClick={handleDownload}>
              <Download aria-hidden="true" className="mr-1.5 h-4 w-4" />
              Download transcript
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div aria-busy="true" className="space-y-3">
          <p role="status" className="sr-only">Loading transcript</p>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="space-y-4 rounded-xl border border-destructive/40 bg-card p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">Transcript could not be loaded</h2>
            <p className="mt-1 text-sm text-muted-foreground">The conversation was not returned. Check your connection and try again.</p>
          </div>
          <Button variant="outline" className="min-h-11" onClick={load}>Try again</Button>
        </div>
      ) : turns.length === 0 ? (
        <div className="space-y-3 rounded-xl border bg-card px-6 py-14 text-center">
          <MessageSquareOff aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No transcript recorded</h2>
          <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">
            This session has no conversation turns. That happens when the interview ended before the first question was answered.
          </p>
        </div>
      ) : (
        <>
          <section aria-label="Transcript overview" className="grid grid-cols-2 divide-y rounded-xl border bg-card sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            <div className="px-5 py-4">
              <p className="text-sm text-muted-foreground">Candidate turns</p>
              <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{candidateCount}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-muted-foreground">AI questions</p>
              <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{aiCount}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-muted-foreground">Total turns</p>
              <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{turns.length}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-muted-foreground">Interview length</p>
              <p className="mt-1 font-semibold">{formatDuration(durationSeconds) ?? "Not recorded"}</p>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="transcript-search">Search the transcript</Label>
                  <div className="relative">
                    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="transcript-search"
                      autoComplete="off"
                      className="pl-9"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Find a word or phrase in the conversation"
                      type="search"
                      value={query}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="block text-sm font-medium">Show</span>
                  <div role="group" aria-label="Filter transcript by speaker" className="flex flex-wrap gap-2">
                    {SPEAKER_FILTERS.map((option) => (
                      <Button
                        key={option.value}
                        aria-pressed={speaker === option.value}
                        className={cn(
                          "min-h-11",
                          speaker === option.value && "border-primary bg-primary/10 text-primary hover:bg-primary/15"
                        )}
                        onClick={() => setSpeaker(option.value)}
                        variant="outline"
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              {visibleTurns.length === turns.length
                ? `${turns.length} turns`
                : `${visibleTurns.length} of ${turns.length} turns match`}
            </p>

            {visibleTurns.length === 0 ? (
              <div className="space-y-3 rounded-xl border bg-card px-6 py-12 text-center">
                <p className="font-semibold">No turns match this filter</p>
                <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">
                  Try a shorter phrase, or switch back to everyone.
                </p>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    setQuery("");
                    setSpeaker("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <ul className="space-y-4">
                {visibleTurns.map((turn) => (
                  <li key={turn.id}>
                    <TranscriptBubble
                      aiLabel="AI interviewer"
                      candidateLabel="Candidate"
                      showIcons
                      speaker={turn.speaker}
                      text={turn.text}
                      timestamp={formatTime(turn.created_at)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
