import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { LEVEL_LABELS } from "@/utils/constants";
import { ArrowLeft, Copy, Check, Eye, Pencil, Clock, Plus, UserRound } from "lucide-react";
import type { Session } from "@/types";
import { useAssessmentInvitePage } from "@/pages/assessments/useAssessmentInvitePage";
import DialogInvite from "@/components/assessment/DialogInvite";

function SessionRow({
  session,
  index,
  assessmentId,
  onCopy,
  copiedId,
}: {
  session: Session;
  index: number;
  assessmentId: string;
  onCopy: (id: number) => void;
  copiedId: number | null;
}) {
  const navigate = useNavigate();
  const isLive = session.status === "active";
  const isEnded = session.status === "ended";
  const isPending = session.status === "pending";
  const displayName = session.candidate_name || `Candidate ${index}`;

  return (
    <div className="flex items-center justify-between py-3 px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center flex-[1_0_auto] justify-center w-7 h-7 rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {index}
        </div>
        <div className="space-y-0.5">
          <div className="text-sm font-medium pr-2">{displayName}</div>
          {session.started_at && (
            <div className="text-xs text-muted-foreground">
              {new Date(session.started_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isPending && (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Awaiting candidate
          </span>
        )}
        {isLive && (
          <span className="flex items-center gap-1 text-xs text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live
          </span>
        )}
        {isEnded && session.end_reason === "error" && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
            Failed
          </span>
        )}
        {isEnded && session.end_reason !== "error" && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Completed
          </span>
        )}

        <div className="flex items-center gap-1.5">
          {isPending && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onCopy(session.id)}
            >
              {copiedId === session.id ? (
                <><Check className="h-3 w-3 mr-1" /> Copied</>
              ) : (
                <><Copy className="h-3 w-3 mr-1" /> Copy link</>
              )}
            </Button>
          )}
          {isLive && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/monitor`)}
            >
              <Eye className="h-3 w-3 mr-1" /> Monitor
            </Button>
          )}
          {isEnded && session.end_reason !== "error" && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => navigate(`/assessments/${assessmentId}/sessions/${session.id}/portfolio`)}
            >
              Results
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AssessmentInvitePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    fetchError,
    assessment,
    sessions,
    loading,
    creatingSession,
    newSession,
    copiedId,
    newSessionCopied,
    showInviteDialog,
    form,
    openInviteDialog,
    onInviteSubmit,
    copyLink,
    copyNewSessionLink,
    setShowInviteDialog,
    refetchData
  } = useAssessmentInvitePage({ id });

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {fetchError ? (
        <div className="flex flex-col items-center justify-center pt-3 pb-6 min-h-[40vh] text-center">
          <p className="mt-1 text-sm text-destructive">
            We couldn't retrieve the page. Please try again.
          </p>

          <Button className="mt-3" variant="destructiveOutline" onClick={refetchData}>
            Try Again
          </Button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between flex-wrap">
            <div className="flex items-center gap-2">
              <Link to="/assessments" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <h1 className="text-lg font-semibold">{assessment?.name ?? "—"}</h1>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Clock className="h-3 w-3" />
                  {assessment?.time_limit_min} min · {assessment?.skills?.length ?? 0} skills
                </div>
              </div>
            </div>

            <div className="flex items-center grow justify-end pt-3 xs:pt-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate(`/assessments/${id}/edit`)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
              </Button>
              <Button size="sm" onClick={openInviteDialog} disabled={creatingSession}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {creatingSession ? "Creating..." : "Invite Candidate"}
              </Button>
            </div>
          </div>

          {/* Invite candidate dialog */}
          <DialogInvite
            open={showInviteDialog}
            onOpenChange={setShowInviteDialog}
            form={form}
            onSubmit={onInviteSubmit}
            loading={creatingSession}
          />
          {/* Newly created session invite link */}
          {newSession && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4 space-y-2">
                <p className="text-sm font-medium">
                  {newSession.candidate_name
                    ? <>Link for <span className="font-semibold">{newSession.candidate_name}</span> ready — share with your candidate:</>
                    : <>New invite link ready — share with your candidate:</>}
                </p>
                <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-white">
                  <span className="flex-1 text-sm font-mono truncate text-muted-foreground">
                    {newSession.invite_url}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={copyNewSessionLink} className="w-full">
                  {newSessionCopied ? (
                    <><Check className="h-3.5 w-3.5 mr-1.5" /> Copied!</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy link</>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Sessions list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Candidates
                {sessions.length > 0 && (
                  <span className="ml-1.5 text-muted-foreground font-normal">({sessions.length})</span>
                )}
              </h2>
            </div>

            {sessions.length === 0 ? (
              <div className="border rounded-lg p-10 text-center space-y-3">
                <UserRound className="h-8 w-8 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-sm font-medium">No candidates yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click "Invite Candidate" to generate an interview link.
                  </p>
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-0 divide-y">
                  {sessions.map((session, i) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      index={sessions.length - i}
                      assessmentId={id!}
                      onCopy={(sid) => {
                        const s = sessions.find((x) => x.id === sid);
                        if (s) copyLink(s, sid);
                      }}
                      copiedId={copiedId}
                    />
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Assessment skills detail */}
          {assessment?.skills && assessment.skills.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h2 className="text-sm font-semibold">Skills assessed</h2>
                <ul className="space-y-1">
                  {assessment.skills.map((s) => (
                    <li key={s.id ?? s.skill_label} className="block sm:flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="hidden sm:flex">•</span>
                      <span className="mr-1 sm:mr-0">{s.skill_label}</span>
                      <span className="text-xs">(expected {LEVEL_LABELS[s.expected_level]})</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
