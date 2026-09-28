import { notify } from "@/components/ui/toast";
import { useBreadcrumbLabel } from "@/components/layout/Breadcrumbs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { FilterSelect } from "@/components/ui/filter-select";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PageHeader,
  ErrorState,
  EmptyState,
  TableLoading,
  SearchField,
  Pagination,
} from "@/components/ui/page";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assessmentsApi } from "@/services/assessments";
import { LEVEL_LABELS } from "@/utils/constants";
import {
  getCandidateDecisionStatus,
  shouldRefreshCandidateSessions,
} from "@/utils/hiringDecision";
import { ArrowLeft, Copy, Check, Pencil, Plus } from "lucide-react";
import type { Assessment, Session } from "@/types";

function interviewStatus(s: Session) {
  if (
    s.status === "failed" ||
    (s.status === "ended" && s.end_reason === "error")
  )
    return "Failed";
  return s.status === "active"
    ? "Live"
    : s.status === "pending"
      ? "Awaiting candidate"
      : "Completed";
}
export default function AssessmentInvitePage() {
  const { id } = useParams<{ id: string }>();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  useBreadcrumbLabel(`assessments:${id}`, assessment?.name);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const copyPending = useRef(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [candidateNameInput, setCandidateNameInput] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All candidates");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("newest");
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, s] = await Promise.all([
        assessmentsApi.get(Number(id)),
        assessmentsApi.getSessions(Number(id)),
      ]);
      setAssessment(a.data.assessment);
      setSessions(s.data.sessions);
    } catch {
      setError(
        "Couldn't load this assessment. Try again to view its candidates.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!shouldRefreshCandidateSessions(sessions)) return;
    const interval = setInterval(async () => {
      try {
        const res = await assessmentsApi.getSessions(Number(id));
        setSessions(res.data.sessions);
      } catch {
        /* Keep the last successful result; the next poll retries. */
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [sessions, id]);
  const openInviteDialog = () => {
    setCandidateNameInput("");
    setActionError(null);
    setShowInviteDialog(true);
  };
  const handleInviteCandidate = async () => {
    if (creatingSession) return;
    setCreatingSession(true);
    setActionError(null);
    try {
      const res = await assessmentsApi.createSession(
        Number(id),
        candidateNameInput.trim() || undefined,
      );
      const created = res.data.session;
      setNewSession(created);
      notify("Invitation created. Share the link with your candidate.");
      setCopiedId(null);
      setSessions((prev) => [created, ...prev]);
      setShowInviteDialog(false);
      setQuery("");
      setFilter("All candidates");
      setPage(1);
    } catch {
      notify("Could not create the invitation. Please try again.", "error");
      setActionError("Couldn't create the invitation. Please try again.");
    } finally {
      setCreatingSession(false);
    }
  };
  const copyLink = async (session: Session) => {
    if (copyPending.current) return;
    copyPending.current = true;
    setActionError(null);
    try {
      await navigator.clipboard.writeText(session.invite_url);
      setCopiedId(session.id);
      notify("Invitation link copied.");
    } catch {
      setCopiedId(null);
      notify("Could not copy the link. You can copy it manually below.", "error");
      setActionError(
        "Couldn't copy the link. Select and copy it from the invitation below.",
      );
      setNewSession(session);
    } finally {
      copyPending.current = false;
    }
  };
  const visible = sessions
    .map((s, i) => ({
      session: s,
      name: s.candidate_name || `Candidate ${sessions.length - i}`,
    }))
    .filter(
      ({ session: s, name }) =>
        name.toLowerCase().includes(query.trim().toLowerCase()) &&
        (filter === "All candidates" ||
          interviewStatus(s) === filter ||
          getCandidateDecisionStatus(s)?.label === filter),
    );
  if (sort === "name") visible.sort((a, b) => a.name.localeCompare(b.name));
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(visible.length / 10)),
  );
  if (loading) return <TableLoading />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  return (
    <div className="space-y-6">
      <Link
        to="/assessments"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All assessments
      </Link>
      <PageHeader
        title={assessment?.name || "Assessment"}
        description={`${assessment?.time_limit_min ?? "—"} minute interview · ${assessment?.skills?.length ?? 0} skills assessed`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={`/assessments/${id}/edit`}>
                <Pencil />
                Edit assessment
              </Link>
            </Button>
            <Button onClick={openInviteDialog} disabled={creatingSession}>
              <Plus />
              Invite candidate
            </Button>
          </>
        }
      />
      {!!assessment?.skills?.length && (
        <Accordion type="single" collapsible className="rounded-lg border px-4">
          <AccordionItem value="requirements" className="border-0">
          <AccordionTrigger className="py-3 text-left text-sm hover:no-underline">Assessment requirements ({assessment.skills.length} skills)</AccordionTrigger>
          <AccordionContent>
          <p className="mt-1 text-xs text-muted-foreground">
            Expected skill levels used in this interview.
          </p>
          <ul className="mt-3 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {assessment.skills.map((s) => (
              <li
                key={s.id ?? s.skill_label}
                className="flex items-center justify-between gap-3 border-b py-2.5 text-sm"
              >
                <span>{s.skill_label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {LEVEL_LABELS[s.expected_level]}
                </span>
              </li>
            ))}
          </ul>
        </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
      <Dialog
        open={showInviteDialog}
        onOpenChange={(open) => {
          if (!creatingSession) setShowInviteDialog(open);
        }}
      >
        <DialogContent className="sm:max-w-md" closeDisabled={creatingSession} aria-busy={creatingSession}>
          <DialogHeader>
            <DialogTitle>Invite candidate</DialogTitle>
            <DialogDescription>
              Create an interview link to share with your candidate.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleInviteCandidate();
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="candidate-name">
                Candidate name{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="candidate-name"
                placeholder="e.g. Budi Santoso"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                disabled={creatingSession}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Helps your team identify this candidate during review.
              </p>
            </div>
            {actionError && <ErrorState message={actionError} />}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={creatingSession}
                onClick={() => setShowInviteDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creatingSession}>
                {creatingSession ? "Creating…" : "Create invite link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {actionError && !showInviteDialog && <ErrorState message={actionError} />}
      {newSession && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p role="status" className="mb-3 text-sm font-medium">
            Interview link for {newSession.candidate_name || "your candidate"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="Candidate invitation link"
              className="min-w-0 flex-1 basis-48 bg-background"
              readOnly
              value={newSession.invite_url}
              onFocus={(e) => e.target.select()}
            />
            <Button variant="outline" onClick={() => void copyLink(newSession)}>
              {copiedId === newSession.id ? <Check /> : <Copy />}
              {copiedId === newSession.id ? "Copied" : "Copy link"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Share this link with the candidate to start their interview.
          </p>
        </div>
      )}
      <section aria-labelledby="candidates-title" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="candidates-title" className="text-base font-semibold">
            Candidates{" "}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {sessions.length}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Track interviews and review completed assessments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SearchField
            label="Search candidates"
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
          />
          <FilterSelect label="Filter candidate status" className="w-full sm:w-48" value={filter} onValueChange={(value) => {
              setFilter(value);
              setPage(1);
            }} options={[
              "All candidates",
              "Awaiting candidate",
              "Live",
              "Completed",
              "Failed",
              "Needs review",
              "Generating report",
              "Report failed",
              "Advanced",
              "On hold",
              "Rejected",
            ].map((label) => ({ value: label, label }))} />
          <FilterSelect label="Sort candidates" className="w-full sm:w-48 sm:ml-auto" value={sort} onValueChange={(value) => {
              setSort(value);
              setPage(1);
            }} options={[{"value":"newest","label":"Newest first"}, {"value":"name","label":"Name: A–Z"}]} />
          {(query || filter !== "All candidates") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setFilter("All candidates");
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border">
          {!sessions.length ? (
            <EmptyState
              title="No candidates yet"
              description="Invite your first candidate to start collecting interview evidence."
              action={
                <Button variant="outline" onClick={openInviteDialog}>
                  <Plus />
                  Invite candidate
                </Button>
              }
            />
          ) : !visible.length ? (
            <EmptyState
              title="No matching candidates"
              description="Try another name or clear the status filter."
            />
          ) : (
            <table className="data-table">
              <caption className="sr-only">
                Candidates for {assessment?.name}
              </caption>
              <thead>
                <tr>
                  {[
                    "Candidate",
                    "Interview",
                    "Evaluation / decision",
                    "Last activity",
                    "Actions",
                  ].map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible
                  .slice((currentPage - 1) * 10, currentPage * 10)
                  .map(({ session: s, name }) => {
                    const status = interviewStatus(s);
                    const decision = getCandidateDecisionStatus(s);
                    const date =
                      s.decided_at ||
                      s.ended_at ||
                      s.started_at ||
                      s.created_at;
                    return (
                      <tr key={s.id}>
                        <td>
                          <div className="flex min-w-40 items-center gap-2.5">
                            <span
                              aria-hidden="true"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
                            >
                              {name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="font-medium">{name}</span>
                          </div>
                        </td>
                        <td>
                          <Badge
                            className="whitespace-nowrap"
                            variant={
                              status === "Live"
                                ? "info"
                                : status === "Failed"
                                  ? "danger"
                                  : status === "Completed"
                                    ? "success"
                                    : "neutral"
                            }
                          >
                            {status}
                          </Badge>
                        </td>
                        <td>
                          {decision ? (
                            <span
                              className={`whitespace-nowrap text-xs font-medium ${decision.className}`}
                            >
                              {decision.label}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Not available yet
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-xs text-muted-foreground">
                          {date
                            ? new Date(date).toLocaleString(undefined, {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td>
                          {s.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void copyLink(s)}
                            >
                              {copiedId === s.id ? <Check /> : <Copy />}
                              {copiedId === s.id ? "Copied" : "Copy link"}
                            </Button>
                          )}
                          {s.status === "active" && (
                            <Button asChild variant="outline" size="sm">
                              <Link
                                to={`/assessments/${id}/sessions/${s.id}/monitor`}
                              >
                                Monitor
                              </Link>
                            </Button>
                          )}
                          {s.status === "ended" && status !== "Failed" && (
                            <Button asChild variant="outline" size="sm">
                              <Link
                                to={`/assessments/${id}/sessions/${s.id}/portfolio`}
                              >
                                {s.hiring_decision ? "View decision" : "Review"}
                              </Link>
                            </Button>
                          )}
                          {status === "Failed" && (
                            <span className="text-xs text-muted-foreground">
                              Interview failed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
        {sessions.length > 0 && (
          <Pagination
            page={currentPage}
            itemLabel="candidates"
            total={visible.length}
            onChange={setPage}
          />
        )}
      </section>

    </div>
  );
}
