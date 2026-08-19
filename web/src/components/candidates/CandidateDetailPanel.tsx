import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatRelativeTime } from "@/utils/formatRelativeTime";
import { openGmailCompose, buildCandidateInviteEmail } from "@/utils/gmailCompose";
import { getInitials } from "@/utils/initials";
import { Mail, Phone, Copy, Check, ArrowLeft, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { Candidate } from "@/types";

export function SessionActions({
  sessionId,
  inviteUrl,
  candidateName,
  candidateEmail,
  assessmentName,
  timeLimitMin,
  expiresAt,
}: {
  sessionId: number;
  inviteUrl: string;
  candidateName?: string;
  candidateEmail?: string;
  assessmentName?: string;
  timeLimitMin?: number;
  expiresAt?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openInGmail = () => {
    const { subject, body } = buildCandidateInviteEmail({
      candidateName,
      roleTitle: assessmentName ?? "the role",
      timeLimitMin,
      expiresAt,
      inviteUrl,
    });
    openGmailCompose({ to: candidateEmail ?? "", subject, body });
  };

  return (
    <div className="flex items-center gap-1.5" key={sessionId}>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={copy}>
        {copied ? <><Check className="h-3 w-3 mr-1" /> Copied</> : <><Copy className="h-3 w-3 mr-1" /> Copy link</>}
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={openInGmail}>
        <Mail className="h-3 w-3 mr-1" /> Share on Gmail
      </Button>
    </div>
  );
}

export function CandidateDetailPanel({ candidate, loading, onBack, showSessionActions = true }: {
  candidate: Candidate | null;
  loading: boolean;
  onBack?: () => void;
  showSessionActions?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-12 text-center">
        Select a candidate to see their details.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to list
        </button>
      )}

      <div className="flex items-center gap-3">
        <Avatar className="h-11 w-11">
          <AvatarFallback className="text-sm">{getInitials(candidate.name)}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-lg font-semibold">{candidate.name}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {candidate.email}</span>
            {candidate.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {candidate.phone}</span>}
          </div>
        </div>
      </div>

      {candidate.address && (
        <p className="text-sm text-muted-foreground">{candidate.address}</p>
      )}

      {candidate.cv_url && (
        <a
          href={candidate.cv_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" /> View CV
        </a>
      )}

      <Separator />

      <div className="space-y-2">
        <p className="text-sm font-medium">
          Interviews
          {candidate.sessions && <span className="ml-1.5 text-muted-foreground font-normal">({candidate.sessions.length})</span>}
        </p>

        {!candidate.sessions || candidate.sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No interviews yet.</p>
        ) : (
          <div className="space-y-2">
            {candidate.sessions.map((s) => {
              const usedMin = s.duration_seconds ? Math.round(s.duration_seconds / 60) : null;
              const showDuration = (s.status === "active" || s.status === "ended") && s.time_limit_min;
              return (
                <div key={s.id} className="border rounded-lg px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.assessment_name}</p>
                    <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground mt-0.5">
                      <span>{formatRelativeTime(s.created_at)}</span>
                      <span>·</span>
                      <span className="capitalize">{s.status}</span>
                      {showDuration && (
                        <>
                          <span>·</span>
                          <span>{usedMin !== null ? `${usedMin} / ${s.time_limit_min} min` : `${s.time_limit_min} min`}</span>
                        </>
                      )}
                      {s.expired && <span className="text-destructive">· expired</span>}
                    </div>
                  </div>
                  {showSessionActions && s.status === "pending" && !s.expired && (
                    <SessionActions
                      sessionId={s.id}
                      inviteUrl={s.invite_url}
                      candidateName={candidate.name}
                      candidateEmail={candidate.email}
                      assessmentName={s.assessment_name}
                      timeLimitMin={s.time_limit_min}
                      expiresAt={s.expires_at}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
