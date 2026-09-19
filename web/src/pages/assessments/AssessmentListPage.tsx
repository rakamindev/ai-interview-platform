import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PageHead from "@/components/design/PageHead";
import BadgeDot, { type BadgeTone } from "@/components/design/BadgeDot";
import MetaChip from "@/components/design/MetaChip";
import Banner from "@/components/design/Banner";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight, Mic } from "lucide-react";
import type { Assessment } from "@/types";

const LANGUAGE_LABELS: Record<string, string> = { en: "English", id: "Indonesian" };

interface SessionMeta {
  tone: BadgeTone;
  label: string;
  side: string;
}

function sessionMeta(session?: Assessment["latest_session"]): SessionMeta | null {
  if (!session) return null;
  if (session.status === "active")
    return { tone: "live", label: "Live now", side: "Interview in progress" };
  if (session.status === "pending")
    return { tone: "ready", label: "Awaiting candidate", side: "Invite link ready" };
  if (session.status === "ended" && session.end_reason === "error")
    return { tone: "fail", label: "Last: failed", side: "Connection lost mid-interview" };
  if (session.status === "ended")
    return { tone: "ok", label: "Last: completed", side: "Results available" };
  return null;
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHead
        title="Assessments"
        subtitle="Voice interviews you've set up. Open one to invite candidates or review results."
      >
        <Button onClick={() => navigate("/assessments/new")}>
          <Plus className="h-4 w-4" /> New Assessment
        </Button>
      </PageHead>

      {error && <Banner tone="fail">Failed to load assessments. Please refresh the page.</Banner>}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[86px] w-full rounded-[14px]" />
          ))}
        </div>
      ) : assessments.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-card p-12 text-center">
          <span className="mx-auto mb-3 grid h-[52px] w-[52px] place-items-center rounded-full border border-dashed border-[var(--border-strong)] text-faint">
            <Mic className="h-5 w-5" />
          </span>
          <h3 className="font-display text-[15px] font-semibold text-foreground">
            No assessments yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-[340px] text-sm text-muted-foreground">
            Create your first voice interview to start assessing candidates.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4" /> Create your first assessment
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => {
            const meta = sessionMeta(a.latest_session);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => navigate(`/assessments/${a.id}/invite`)}
                className="group flex w-full items-center gap-[18px] rounded-[14px] border border-border bg-card px-5 py-[18px] text-left transition-all hover:border-brand hover:shadow-md active:translate-y-px"
              >
                <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-deep">
                  <Mic className="h-[19px] w-[19px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[15px] font-semibold tracking-tight text-foreground">
                    {a.name}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <MetaChip icon={<Clock className="h-3 w-3" />}>{a.time_limit_min} min</MetaChip>
                    {a.language && (
                      <MetaChip>{LANGUAGE_LABELS[a.language] ?? a.language}</MetaChip>
                    )}
                    {a.skills && a.skills.length > 0 && (
                      <MetaChip>{a.skills.length} skills</MetaChip>
                    )}
                    {meta && <BadgeDot tone={meta.tone}>{meta.label}</BadgeDot>}
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-3.5">
                  {meta && (
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {meta.side}
                    </span>
                  )}
                  <span className="grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors group-hover:bg-brand-soft group-hover:text-brand-deep">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
