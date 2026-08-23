import {useEffect, useState} from "react";
import {Link, useParams} from "react-router-dom";
import {Button} from "@/components/ui/button";
import {Skeleton} from "@/components/ui/skeleton";
import {sessionsApi} from "@/services/sessions";
import {ArrowLeft, Download} from "lucide-react";
import type {TranscriptTurn} from "@/types";
import TranscriptBubble from "@/components/interview/TranscriptBubble.tsx";

export default function TranscriptPage() {
    const {id, sessionId} = useParams<{ id: string; sessionId: string }>();
    const [turns, setTurns] = useState<TranscriptTurn[]>([]);
    const [candidateName, setCandidateName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

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

    const formatAudioTime = (milliseconds: number) => {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const ms = milliseconds % 1000;

        return `${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
    };

    const handleDownload = () => {
        const lines = turns.map((t) => {
            const label = t.speaker === "ai" ? "AI Interviewer" : "Candidate";
            const time = t.audio_start_ms !== undefined ? formatAudioTime(t.audio_start_ms) : "N/A";

            return `[${label}] - ${time}\n${t.text}`;
        });

        const blob = new Blob([lines.join("\n\n")], {type: "text/plain"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `transcript-session-${candidateName}.txt`;
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
                        <ArrowLeft className="h-4 w-4"/>
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
                        <Download className="h-3.5 w-3.5 mr-1.5"/>
                        Download .txt
                    </Button>
                )}
            </div>

            {loading && (
                <div className="space-y-3">
                    {Array.from({length: 6}).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full"/>
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
                <div className="space-y-4">
                    {turns.map((turn) => {
                        return (
                            <TranscriptBubble
                                key={turn.id}
                                speaker={turn.speaker}
                                text={turn.text}
                                createdAt={turn.created_at}
                                audioStartMs={turn.audio_start_ms}
                            />
                        );
                    })}
                </div>
            )}

        </div>
    );
}
