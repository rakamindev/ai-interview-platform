import { FormEvent, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionsApi } from "@/services/sessions";
import { ArrowLeft, Download, Volume2 } from "lucide-react";
import type { TranscriptTurn } from "@/types";

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  const saveRevision = async (event: FormEvent, turn: TranscriptTurn) => {
    event.preventDefault();
    setSaving(true);
    try {
      await sessionsApi.reviseTranscriptTurn(turn.id, draft, reason);
      setTurns((current) => current.map((item) => item.id === turn.id ? { ...item, text: draft } : item));
      setEditingId(null);
      setReason("");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    Promise.all([
      sessionsApi.getTranscript(Number(sessionId)),
      sessionsApi.get(Number(sessionId)),
    ])
      .then(([tRes, sRes]) => {
        setTurns(tRes.data.turns);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const loadRecording = async () => {
    try {
      const response = await sessionsApi.getRecordingPlayback(Number(sessionId));
      setPlaybackUrl(response.data.playback_url);
    } catch {
      setPlaybackUrl(null);
    }
  };

  const handleDownload = () => {
    const lines = turns.map((t) => {
      const label = t.speaker === "ai" ? "AI" : "Candidate";
      return `[${label}]\n${t.text}`;
    });
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-session-${sessionId}.txt`;
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
            {candidateName && (
              <p className="text-sm text-muted-foreground">{candidateName}</p>
            )}
          </div>
        </div>
        {!loading && !error && turns.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download .txt
          </Button>
        )}
      </div>

      {!loading && !error && !playbackUrl && (
        <Button variant="outline" size="sm" onClick={loadRecording}>
          <Volume2 className="h-3.5 w-3.5 mr-1.5" />
          Load recording
        </Button>
      )}

      {playbackUrl && (
        <audio className="w-full" controls src={playbackUrl}>
          Your browser cannot play this recording.
        </audio>
      )}

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
        <div className="space-y-3">
          {turns.map((turn) => {
            const isAI = turn.speaker === "ai";
            return (
              <div
                key={turn.id}
                className={`rounded-lg p-4 ${
                  isAI
                    ? "bg-muted border"
                    : "bg-background border border-primary/20"
                }`}
              >
                <p
                  className={`text-xs font-semibold mb-1 ${
                    isAI ? "text-muted-foreground" : "text-primary"
                  }`}
                >
                  {isAI ? "AI Interviewer" : "Candidate"}
                </p>
                <p className="text-sm whitespace-pre-wrap">{turn.text}</p>
                {!isAI && editingId !== turn.id && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => {
                    setEditingId(turn.id);
                    setDraft(turn.text);
                  }}>
                    Correct transcript
                  </Button>
                )}
                {!isAI && editingId === turn.id && (
                  <form className="mt-3 space-y-2" onSubmit={(event) => saveRevision(event, turn)}>
                    <textarea className="min-h-24 w-full rounded border bg-background p-2 text-sm" value={draft} onChange={(event) => setDraft(event.target.value)} required />
                    <input className="w-full rounded border bg-background p-2 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for correction" required />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={saving}>{saving ? "Saving…" : "Save correction"}</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
