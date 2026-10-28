import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { REVIEW_GROUPS, groupCount, reasonText, waitingText } from "@/components/review/reviewText";
import { reviewQueueApi } from "@/services/reviewQueue";
import type { ReviewGroup, ReviewQueue, ReviewQueueItem } from "@/types";

const PREVIEW_COUNT = 5;

function reviewPath(item: ReviewQueueItem) {
  const base = `/assessments/${item.assessment_id}/sessions/${item.session_id}`;
  return item.target.page === "fitgap" && item.target.vacancy_id ? `${base}/fitgap/${item.target.vacancy_id}` : `${base}/portfolio`;
}

function Reasons({ item }: { item: ReviewQueueItem }) {
  return (
    <div className="flex flex-wrap gap-1">
      {item.reasons.map((reason) => (
        <StatusBadge key={reason.code} tone={reason.code === "generation_failed" ? "danger" : "warning"}>
          {reasonText(reason)}
        </StatusBadge>
      ))}
    </div>
  );
}

function ReviewLink({ item }: { item: ReviewQueueItem }) {
  const name = item.candidate_name || "candidate";
  return (
    <Button asChild size="sm" variant="outline">
      <Link to={reviewPath(item)} aria-label={`Review ${name}`}>Review</Link>
    </Button>
  );
}

interface NeedsReviewSectionProps {
  // Fixed in tests so waiting times are stable.
  now?: Date;
}

// What still needs a human (UU PDP Pasal 10): counts per reason group, which
// filter the list, and the oldest items first. No scores and no ranking.
export default function NeedsReviewSection({ now }: NeedsReviewSectionProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [group, setGroup] = useState<ReviewGroup | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const retrying = useRef(false);

  const load = useCallback((reason: ReviewGroup | undefined) => {
    setLoading(true);
    setFailed(false);
    reviewQueueApi.list({ reason, page: 1 })
      .then((res) => setQueue(res.data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(group); }, [load, group]);

  // After a successful "Try again" the error and its button are gone, so
  // focus moves to the section heading instead of falling to <body>.
  useEffect(() => {
    if (loading || !retrying.current) return;
    retrying.current = false;
    headingRef.current?.focus();
  }, [loading]);

  const toggleGroup = (next: ReviewGroup) => {
    setShowAll(false);
    setGroup((current) => (current === next ? undefined : next));
  };

  const items = queue?.items ?? [];
  const visible = showAll ? items : items.slice(0, PREVIEW_COUNT);
  const total = queue?.meta.total_count ?? items.length;

  return (
    <section aria-labelledby={headingId} className="space-y-4 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
      <div className="space-y-1">
        <h2 id={headingId} ref={headingRef} tabIndex={-1}
            className="rounded-sm text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Needs review
        </h2>
        <p className="text-sm text-muted-foreground">
          AI ratings and reports that a person still has to check, oldest first. Select a number to filter the list.
        </p>
      </div>

      {queue && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {REVIEW_GROUPS.map((info) => (
            <StatCard key={info.group} label={info.label} value={groupCount(queue.summary, info)} icon={info.icon}
                      tone={groupCount(queue.summary, info) > 0 ? "warning" : "muted"}
                      pressed={group === info.group} onToggle={() => toggleGroup(info.group)} />
          ))}
        </div>
      )}

      {loading ? (
        <div aria-busy="true" aria-label="Loading the review queue" className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : failed ? (
        <ErrorState title="Could not load the review queue" description="The rest of the page still works. Try again in a moment."
                    onRetry={() => { retrying.current = true; load(group); }} />
      ) : items.length === 0 ? (
        <EmptyState icon={CheckCircle2}
                    title={group ? "Nothing in this group needs review" : "Nothing needs review right now"}
                    description={group ? "Select the number again to show every reason." : "Every finished portfolio has been checked by a person."} />
      ) : (
        <>
          <table className="hidden w-full text-left text-sm lg:table">
            <caption className="sr-only">Portfolios that need review, oldest first</caption>
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">Candidate</th>
                <th scope="col" className="py-2 pr-3 font-medium">Assessment</th>
                <th scope="col" className="py-2 pr-3 font-medium">Needs</th>
                <th scope="col" className="py-2 pr-3 font-medium">Waiting</th>
                <th scope="col" className="py-2"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((item) => (
                <tr key={item.portfolio_id} className="align-middle">
                  <td className="py-3 pr-3 font-medium"><span className="[overflow-wrap:anywhere]">{item.candidate_name || "Unnamed candidate"}</span></td>
                  <td className="py-3 pr-3 text-muted-foreground"><span className="[overflow-wrap:anywhere]">{item.assessment_name}</span></td>
                  <td className="py-3 pr-3"><Reasons item={item} /></td>
                  <td className="whitespace-nowrap py-3 pr-3 text-muted-foreground">{waitingText(item.waiting_since, now)}</td>
                  <td className="py-3 text-right"><ReviewLink item={item} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="space-y-2 lg:hidden">
            {visible.map((item) => (
              <li key={item.portfolio_id} className="space-y-2 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="font-medium [overflow-wrap:anywhere]">{item.candidate_name || "Unnamed candidate"}</p>
                  <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{item.assessment_name}</p>
                </div>
                <Reasons item={item} />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{waitingText(item.waiting_since, now)}</span>
                  <ReviewLink item={item} />
                </div>
              </li>
            ))}
          </ul>

          {items.length > PREVIEW_COUNT && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((value) => !value)}
                    aria-label={showAll ? "Show fewer" : `Show all ${items.length}`}>
              {showAll ? "Show fewer" : `Show all ${items.length}`}
            </Button>
          )}
          {total > items.length && (
            <p className="text-xs text-muted-foreground">{`Showing the ${items.length} oldest of ${total}.`}</p>
          )}
        </>
      )}
    </section>
  );
}
