import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionsApi } from "@/services/sessions";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
import { Copy, Check, Download, RefreshCw, Lock } from "lucide-react";
import type { TranscriptTurn } from "@/types";

interface TranscriptViewerProps {
  token: string;
}

function toText(turns: TranscriptTurn[]): string {
  return turns
    .map(
      (t) => `${t.speaker === "candidate" ? "You" : "Interviewer"}: ${t.text}`
    )
    .join("\n\n");
}

export default function TranscriptViewer({ token }: TranscriptViewerProps) {
  const [turns, setTurns] = useState<TranscriptTurn[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    sessionsApi
      .getCandidateTranscript(token)
      .then((res) => {
        if (cancelled) return;
        setTurns(res.data.turns);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e?.response?.status === 403) {
          setError("Consent required to view the transcript.");
        } else {
          setError("Couldn't load the transcript. Please try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  const retry = () => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  };

  const copyAll = async () => {
    if (!turns?.length) return;
    await navigator.clipboard.writeText(toText(turns));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    if (!turns?.length) return;
    const blob = new Blob([toText(turns)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "interview-transcript.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Lock className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={retry}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
        </Button>
      </div>
    );
  }

  if (!turns?.length) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No transcript is available for this interview yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {turns.length} message{turns.length === 1 ? "" : "s"} · read-only
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyAll}>
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy all
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={download}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Download
          </Button>
        </div>
      </div>

      <div className="space-y-2 overflow-y-auto max-h-[60vh]">
        {turns.map((turn) => (
          <TranscriptBubble
            key={turn.id ?? turn.turn_number}
            speaker={turn.speaker}
            text={turn.text}
          />
        ))}
      </div>
    </div>
  );
}
