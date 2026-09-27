
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Download,
  FileText,
  MessageSquareText,
  RefreshCw,
  Search,
  UserRound,
  X,
} from "lucide-react";

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

import type { TranscriptTurn } from "@/types";

type SpeakerFilter =
  | "all"
  | "candidate"
  | "ai"
  | "assessor"
  | "system";

const speakerLabels: Record<
  TranscriptTurn["speaker"],
  string
> = {
  candidate: "Candidate",
  ai: "AI Interviewer",
  assessor: "Assessor",
  system: "System",
};

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function downloadTranscript(
  turns: TranscriptTurn[],
  sessionId: string
) {
  const content = turns
    .map((turn) => {
      const speaker = speakerLabels[turn.speaker];
      const time = formatTimestamp(turn.created_at);
      const heading = time
        ? `[${speaker}] ${time}`
        : `[${speaker}]`;

      return `${heading}\n${turn.text}`;
    })
    .join("\n\n");

  const blob = new Blob([content], {
    type: "text/plain;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `transcript-session-${sessionId}.txt`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function TranscriptMessage({
  turn,
}: {
  turn: TranscriptTurn;
}) {
  const isCandidate = turn.speaker === "candidate";
  const isAI = turn.speaker === "ai";

  const speakerName = speakerLabels[turn.speaker];
  const timestamp = formatTimestamp(turn.created_at);

  return (
    <article
      className={`flex gap-3 ${
        isCandidate ? "flex-row-reverse" : ""
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          isCandidate
            ? "bg-primary/10 text-primary"
            : isAI
              ? "bg-slate-100 text-slate-600"
              : "bg-amber-50 text-amber-700"
        }`}
      >
        {isCandidate ? (
          <UserRound className="h-5 w-5" />
        ) : isAI ? (
          <Bot className="h-5 w-5" />
        ) : (
          <MessageSquareText className="h-5 w-5" />
        )}
      </div>

      <div
        className={`min-w-0 max-w-[calc(100%-3.25rem)] flex-1 sm:max-w-[85%] ${
          isCandidate ? "text-right" : ""
        }`}
      >
        <div
          className={`mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 ${
            isCandidate ? "justify-end" : ""
          }`}
        >
          <span
            className={`text-sm font-semibold ${
              isCandidate
                ? "text-primary"
                : "text-slate-800"
            }`}
          >
            {speakerName}
          </span>

          <span className="text-xs text-slate-400">
            Turn {turn.turn_number}
            {timestamp ? ` · ${timestamp}` : ""}
          </span>
        </div>

        <div
          className={`rounded-2xl border px-4 py-3 text-left shadow-sm sm:px-5 sm:py-4 ${
            isCandidate
              ? "rounded-tr-md border-primary/15 bg-primary/5"
              : "rounded-tl-md border-slate-200 bg-white"
          }`}
        >
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
            {turn.text}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{
    id: string;
    sessionId: string;
  }>();

  const numericSessionId = Number(sessionId);

  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [candidateName, setCandidateName] = useState<
    string | null
  >(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [speakerFilter, setSpeakerFilter] =
    useState<SpeakerFilter>("all");

  const portfolioUrl =
    `/assessments/${id}/sessions/${sessionId}/portfolio`;

  const loadTranscript = useCallback(
    async (showLoading = true) => {
      if (
        !Number.isInteger(numericSessionId) ||
        numericSessionId <= 0
      ) {
        setError(true);
        setLoading(false);
        return;
      }

      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError(false);

      try {
        const [transcriptResponse, sessionResponse] =
          await Promise.all([
            sessionsApi.getTranscript(numericSessionId),
            sessionsApi.get(numericSessionId),
          ]);

        const sortedTurns = [
          ...transcriptResponse.data.turns,
        ].sort((a, b) => a.turn_number - b.turn_number);

        setTurns(sortedTurns);

        setCandidateName(
          sessionResponse.data.session.candidate_name ??
            null
        );
      } catch (err) {
        console.error(
          "Failed to load transcript:",
          err
        );

        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [numericSessionId]
  );

  useEffect(() => {
    void loadTranscript();
  }, [loadTranscript]);

  const filteredTurns = useMemo(() => {
    const normalizedQuery = searchQuery
      .trim()
      .toLowerCase();

    return turns.filter((turn) => {
      const matchesSpeaker =
        speakerFilter === "all" ||
        turn.speaker === speakerFilter;

      const matchesSearch =
        normalizedQuery.length === 0 ||
        turn.text
          .toLowerCase()
          .includes(normalizedQuery) ||
        speakerLabels[turn.speaker]
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesSpeaker && matchesSearch;
    });
  }, [turns, searchQuery, speakerFilter]);

  const candidateTurns = turns.filter(
    (turn) => turn.speaker === "candidate"
  ).length;

  const aiTurns = turns.filter(
    (turn) => turn.speaker === "ai"
  ).length;

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    speakerFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSpeakerFilter("all");
  };

  const handleDownload = () => {
    if (!sessionId || turns.length === 0) {
      return;
    }

    downloadTranscript(turns, sessionId);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-10">
      <header className="space-y-5">
        <Link
          to={portfolioUrl}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portfolio
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-primary">
              Interview Assessment
            </p>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Interview Transcript
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Review the complete interview conversation
              and find specific responses.
            </p>

            {candidateName && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
                <UserRound className="h-4 w-4 text-slate-400" />
                {candidateName}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                void loadTranscript(false);
              }}
              disabled={loading || refreshing}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  refreshing ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>

            <Button
              type="button"
              className="rounded-xl"
              onClick={handleDownload}
              disabled={
                loading ||
                error ||
                turns.length === 0
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Download .txt
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">
              Total Messages
            </p>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageSquareText className="h-5 w-5" />
            </div>
          </div>

          {loading ? (
            <Skeleton className="mt-4 h-8 w-16" />
          ) : (
            <p className="mt-4 text-2xl font-bold text-slate-900">
              {turns.length}
            </p>
          )}

          <p className="mt-2 text-xs text-slate-500">
            Recorded conversation turns
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">
              Candidate Messages
            </p>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <UserRound className="h-5 w-5" />
            </div>
          </div>

          {loading ? (
            <Skeleton className="mt-4 h-8 w-16" />
          ) : (
            <p className="mt-4 text-2xl font-bold text-slate-900">
              {candidateTurns}
            </p>
          )}

          <p className="mt-2 text-xs text-slate-500">
            Candidate responses
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">
              AI Messages
            </p>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Bot className="h-5 w-5" />
            </div>
          </div>

          {loading ? (
            <Skeleton className="mt-4 h-8 w-16" />
          ) : (
            <p className="mt-4 text-2xl font-bold text-slate-900">
              {aiTurns}
            </p>
          )}

          <p className="mt-2 text-xs text-slate-500">
            AI interviewer messages
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Conversation
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Messages shown in chronological order
                </p>
              </div>
            </div>

            {!loading && !error && (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                {filteredTurns.length} of {turns.length} messages
              </span>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <Input
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                }}
                placeholder="Search conversation..."
                aria-label="Search conversation"
                className="h-11 rounded-xl border-slate-200 pl-10"
              />
            </div>

            <Select
              value={speakerFilter}
              onValueChange={(value) => {
                setSpeakerFilter(
                  value as SpeakerFilter
                );
              }}
            >
              <SelectTrigger
                aria-label="Filter by speaker"
                className="h-11 rounded-xl border-slate-200"
              >
                <SelectValue placeholder="All Speakers" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  All Speakers
                </SelectItem>

                <SelectItem value="candidate">
                  Candidate
                </SelectItem>

                <SelectItem value="ai">
                  AI Interviewer
                </SelectItem>

                <SelectItem value="assessor">
                  Assessor
                </SelectItem>

                <SelectItem value="system">
                  System
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Showing messages matching your filters.
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <X className="h-3.5 w-3.5" />
                Clear Filters
              </button>
            </div>
          )}
        </div>

        <div className="p-5 sm:p-6">
          {loading && (
            <div className="space-y-7">
              {Array.from({ length: 5 }).map(
                (_, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${
                      index % 2 === 0
                        ? ""
                        : "flex-row-reverse"
                    }`}
                  >
                    <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />

                    <div className="w-full max-w-[75%] space-y-3">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-24 w-full rounded-2xl" />
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {!loading && error && (
            <div
              role="alert"
              className="py-14 text-center"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <AlertCircle className="h-7 w-7" />
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-900">
                Unable to Load Transcript
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                The conversation could not be loaded.
                Please check your connection and try again.
              </p>

              <Button
                className="mt-5 rounded-xl"
                onClick={() => {
                  void loadTranscript();
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </div>
          )}

          {!loading &&
            !error &&
            turns.length === 0 && (
              <div className="py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <MessageSquareText className="h-7 w-7" />
                </div>

                <h3 className="mt-5 text-lg font-bold text-slate-900">
                  No Transcript Available
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  No conversation has been recorded
                  for this interview session.
                </p>
              </div>
            )}

          {!loading &&
            !error &&
            turns.length > 0 &&
            filteredTurns.length === 0 && (
              <div className="py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Search className="h-7 w-7" />
                </div>

                <h3 className="mt-5 text-lg font-bold text-slate-900">
                  No Matching Messages
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Try a different search term
                  or change the speaker filter.
                </p>

                <Button
                  variant="outline"
                  className="mt-5 rounded-xl"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              </div>
            )}

          {!loading &&
            !error &&
            filteredTurns.length > 0 && (
              <div className="space-y-7">
                {filteredTurns.map((turn) => (
                  <TranscriptMessage
                    key={turn.id}
                    turn={turn}
                  />
                ))}
              </div>
            )}
        </div>

        {!loading &&
          !error &&
          turns.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
              <p className="text-xs leading-5 text-slate-500">
                Download includes all recorded messages,
                regardless of the active filters.
              </p>

              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={handleDownload}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Transcript
              </Button>
            </div>
          )}
      </section>

      <div className="flex justify-end">
        <Button
          variant="outline"
          asChild
          className="rounded-xl"
        >
          <Link to={portfolioUrl}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Portfolio
          </Link>
        </Button>
      </div>
    </div>
  );
}