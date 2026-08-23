import {useNavigate} from "react-router-dom";
import {Button} from "@/components/ui/button";
import {Check, Copy, Eye, RefreshCw} from "lucide-react";
import type {Assessment, Session} from "@/types";

interface SessionRowProps {
    assessment: Assessment
    session: Session;
    index: number;
    onCopy: (id: number) => void;
    onReset: (sessionId: number) => void;
    copiedId: number | null;
}

export default function SessionRow({
                                        assessment,
                                       session,
                                       index,
                                       onCopy,
                                       onReset,
                                       copiedId,
                                   }: SessionRowProps) {
    const navigate = useNavigate();

    const isLive = session.status === "active";
    const isEnded = session.status === "ended";
    const isPending = session.status === "pending";

    const displayName =
        session.candidate_name || `Candidate ${index}`;

    return (
        <div className="flex items-center justify-between py-3 px-4">
            <div className="flex items-center gap-3">
                <div
                    className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-medium text-muted-foreground"
                >
                    {index}
                </div>

                <div className="space-y-0.5">
                    <div className="text-sm font-medium">
                        {displayName}
                    </div>

                    {session.started_at && (
                        <div className="text-xs text-muted-foreground">
                            {new Date(
                                session.started_at
                            ).toLocaleDateString()}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
                {isPending && (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"/>
                        Awaiting candidate
                    </span>
                )}

                {isLive && (
                    <span className="flex items-center gap-1 text-xs text-primary">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"/>
                        Live
                    </span>
                )}

                {isEnded && session.end_reason === "error" && (
                    <>
                        <span className="flex items-center gap-1 text-xs text-destructive">
                            <span className="w-1.5 h-1.5 rounded-full bg-destructive"/>
                            Failed
                        </span>

                        {assessment.vacancy_status === "running" && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onReset(session.id)}
                            >
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5"/>
                                Reset
                            </Button>
                        )}

                    </>
                )}

                {isEnded && session.end_reason !== "error" && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"/>
                        Completed
                    </span>
                )}

                <div className="flex items-center gap-1.5">
                    {isPending && assessment.vacancy_status === "running" && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => onCopy(session.id)}
                        >
                            {copiedId === session.id ? (
                                <>
                                    <Check className="h-3 w-3 mr-1"/>
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Copy className="h-3 w-3 mr-1"/>
                                    Copy link
                                </>
                            )}
                        </Button>
                    )}

                    {isLive && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                                navigate(
                                    `/assessments/${session.assessment_id}/sessions/${session.id}/monitor`
                                )
                            }
                        >
                            <Eye className="h-3 w-3 mr-1"/>
                            Monitor
                        </Button>
                    )}

                    {isEnded && session.end_reason !== "error" && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                                navigate(
                                    `/assessments/${session.assessment_id}/sessions/${session.id}/portfolio`
                                )
                            }
                        >
                            Results
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}