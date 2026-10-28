import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { authAtom, clearToken } from "@/stores/authAtom";
import { extractInviteToken } from "@/lib/invite";
import { candidateApi } from "@/services/candidate";
import type { CandidateSession } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Loader2,
    LogOut,
    RefreshCw,
    Video,
} from "lucide-react";

const formatDate = (value?: string | null) =>
    value
        ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
        : null;

const formatDateTime = (value?: string | null) =>
    value
        ? new Date(value).toLocaleString(undefined, {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
          })
        : null;

const formatDuration = (seconds?: number | null) => {
    if (seconds == null || seconds <= 0) return null;
    const minutes = Math.round(seconds / 60);
    return minutes < 1 ? "under a minute" : `${minutes} min`;
};

const STATUS_LABELS: Record<CandidateSession["status"], string> = {
    pending: "Upcoming",
    active: "In progress",
    ended: "Completed",
    failed: "Not completed",
};

function StatusBadge({ status }: { status: CandidateSession["status"] }) {
    if (status === "ended") {
        return (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                {STATUS_LABELS.ended}
            </Badge>
        );
    }
    if (status === "failed") {
        return (
            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                {STATUS_LABELS.failed}
            </Badge>
        );
    }
    if (status === "active") {
        return <Badge>{STATUS_LABELS.active}</Badge>;
    }
    return <Badge variant="secondary">{STATUS_LABELS.pending}</Badge>;
}

function SessionRow({
    session,
    onOpen,
}: {
    session: CandidateSession;
    onOpen: (token: string) => void;
}) {
    const meta: string[] = [];

    if (session.status === "pending" || session.status === "failed") {
        const assigned = formatDate(session.created_at);
        if (assigned) meta.push(`Assigned ${assigned}`);
    }
    if (session.status === "active") {
        const started = formatDateTime(session.started_at);
        if (started) meta.push(`Started ${started}`);
    }
    if (session.status === "ended") {
        const completed = formatDateTime(session.ended_at);
        if (completed) meta.push(`Completed ${completed}`);
        const duration = formatDuration(session.duration_seconds);
        if (duration) meta.push(duration);
    }
    if (session.time_limit_min) meta.push(`${session.time_limit_min} min`);

    const action = session.status === "pending" ? "Start" : session.status === "active" ? "Resume" : null;

    return (
        <div className="rounded-lg border bg-card px-3 py-2.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{session.role_title || "Interview"}</p>
                    {meta.length > 0 && (
                        <p className="text-xs text-muted-foreground">{meta.join(" · ")}</p>
                    )}
                </div>
                <StatusBadge status={session.status} />
            </div>

            {action && (
                <Button
                    size="sm"
                    variant={session.status === "active" ? "default" : "outline"}
                    className="w-full"
                    onClick={() => onOpen(session.invite_token)}
                >
                    {action}
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
            )}
        </div>
    );
}

function Section({
    title,
    sessions,
    onOpen,
}: {
    title: string;
    sessions: CandidateSession[];
    onOpen: (token: string) => void;
}) {
    if (sessions.length === 0) return null;

    return (
        <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
            </h2>
            <div className="space-y-2">
                {sessions.map((session) => (
                    <SessionRow key={session.id} session={session} onOpen={onOpen} />
                ))}
            </div>
        </section>
    );
}

export default function CandidateHomePage() {
    const { email } = useAtomValue(authAtom);
    const setAuth = useSetAtom(authAtom);
    const navigate = useNavigate();
    const [invite, setInvite] = useState("");
    const [error, setError] = useState<string | null>(null);

    const [sessions, setSessions] = useState<CandidateSession[] | null>(null);
    const [sessionsError, setSessionsError] = useState<string | null>(null);
    const [reloading, setReloading] = useState(false);

    const loadSessions = useCallback(async () => {
        try {
            const res = await candidateApi.mySessions();
            setSessions(res.data.sessions ?? []);
            setSessionsError(null);
        } catch {
            setSessions([]);
            setSessionsError("We couldn't load your interviews just now.");
        }
    }, []);

    useEffect(() => {
        void loadSessions();
    }, [loadSessions]);

    const handleRefresh = async () => {
        setReloading(true);
        try {
            await loadSessions();
        } finally {
            setReloading(false);
        }
    };

    const handleOpen = (e: React.FormEvent) => {
        e.preventDefault();
        const token = extractInviteToken(invite);
        if (!token) {
            setError("Paste your interview link to continue.");
            return;
        }
        setError(null);
        navigate(`/interview/${token}`);
    };

    const handleLogout = () => {
        clearToken();
        setAuth({ token: null, role: null, email: null });
        navigate("/login");
    };

    const openInterview = (token: string) => navigate(`/interview/${token}`);

    const upcoming = (sessions ?? []).filter((s) => s.status === "pending");
    const inProgress = (sessions ?? []).filter((s) => s.status === "active");
    const completed = (sessions ?? []).filter((s) => s.status === "ended");
    const notCompleted = (sessions ?? []).filter((s) => s.status === "failed");
    const hasAny = (sessions?.length ?? 0) > 0;

    return (
        <div className="flex-1 flex items-start justify-center px-4 py-12">
            <div className="w-full max-w-md space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-primary" />
                        <h1 className="text-lg font-semibold">Your interview</h1>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleLogout}>
                        <LogOut className="h-4 w-4 mr-1.5" />
                        Logout
                    </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                    Open the interview link from your invitation email to start. You can paste
                    the whole link here, or just the code at the end of it.
                </p>

                <form onSubmit={handleOpen} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="invite">Interview link</Label>
                        <Input
                            id="invite"
                            placeholder="…/interview/abc123"
                            value={invite}
                            onChange={(e) => setInvite(e.target.value)}
                            required
                        />
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <Button type="submit" className="w-full">
                        Open interview
                    </Button>
                </form>

                {/* Interviews that belong to this account, grouped by what the
                    candidate can do with them right now. */}
                <section className="space-y-3 border-t pt-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold">Your interviews</h2>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRefresh()}
                            disabled={reloading}
                            aria-label="Refresh interviews"
                        >
                            <RefreshCw className={"h-3.5 w-3.5 " + (reloading ? "animate-spin" : "")} />
                        </Button>
                    </div>

                    {sessions === null && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading your interviews…
                        </div>
                    )}

                    {sessionsError && (
                        <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{sessionsError}</span>
                        </div>
                    )}

                    {sessions !== null && !hasAny && !sessionsError && (
                        <div className="rounded-lg border border-dashed px-3 py-6 text-center">
                            <CheckCircle2 className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No interviews yet.</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Interviews assigned to {email ?? "your account"} will appear here.
                            </p>
                        </div>
                    )}

                    <Section title="Upcoming" sessions={upcoming} onOpen={openInterview} />
                    <Section title="In progress" sessions={inProgress} onOpen={openInterview} />
                    <Section title="Completed" sessions={completed} onOpen={openInterview} />
                    <Section title="Not completed" sessions={notCompleted} onOpen={openInterview} />
                </section>

                {email && (
                    <p className="text-xs text-muted-foreground text-center">
                        Signed in as {email}
                    </p>
                )}
            </div>
        </div>
    );
}
