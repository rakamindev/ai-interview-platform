import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Clock, Radio, RefreshCw, ScanSearch, TriangleAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import EvidenceStrip from "./EvidenceStrip";
import { duration, relativeTime } from "@/lib/time";
import type { LiveItem, NeedsYouItem, ResultItem, Section } from "@/types/home";
import { Badge } from "@/components/ui/badge";

const nameOf = (name: string | null) => name?.trim() || "Unnamed candidate";
const resultsPath = (assessmentId: number, sessionId: number) =>
  `/assessments/${assessmentId}/sessions/${sessionId}/portfolio`;

// A module with its heading, and its own loading, error and empty states.
function Module<T>({ id, title, count, extra, section, loading, onRetry, empty, children }: {
  id: string; title: string; count?: number; extra?: string; section?: Section<T>; loading: boolean;
  onRetry: () => void; empty: (data: T) => ReactNode | null; children: (data: T) => ReactNode;
}) {
  const heading = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={heading} className="scroll-mt-20 rounded-lg border bg-card p-4">
      <h2 id={heading} tabIndex={-1} className="text-base font-semibold">
        {title}
        {count !== undefined && <span className="text-muted-foreground"> · {count}</span>}
        {extra && <span className="text-muted-foreground"> · {extra}</span>}
      </h2>
      <div className="mt-3">
        {loading || !section ? (
          <div className="space-y-2" aria-hidden="true">
            <Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" />
          </div>
        ) : section.status === "error" ? (
          <div className="space-y-2 text-sm">
            <p>We couldn't load this list.</p>
            <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
          </div>
        ) : (
          empty(section.data) ?? children(section.data)
        )}
      </div>
    </section>
  );
}

function Row({ icon, title, meta, action }: { icon: ReactNode; title: ReactNode; meta: ReactNode; action: ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span className="mt-0.5 shrink-0" aria-hidden="true">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium">{title}</p>
        <div className="text-xs text-muted-foreground">{meta}</div>
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  );
}

function needsYouRow(item: NeedsYouItem) {
  if (item.type === "failed_interview") {
    const name = nameOf(item.candidate_name);
    return (
      <Row
        key={`f-${item.session_id}`}
        icon={<TriangleAlert className="h-4 w-4 text-attention" />}
        title={`${name} · interview failed on our side`}
        meta={
          <>
            <p>{item.assessment.name} · stopped after {duration(item.duration_seconds)} · {relativeTime(item.ended_at)}</p>
            <p>{item.turns === 0 ? "No answers were captured." : `${item.turns} answers were captured.`}</p>
          </>
        }
        action={
          <Button asChild size="sm">
            <Link to={`/assessments/${item.assessment.id}/invite`} aria-label={`Re-invite ${name}`}>Re-invite</Link>
          </Button>
        }
      />
    );
  }
  if (item.type === "stuck_report") {
    const name = nameOf(item.candidate_name);
    const title = item.state === "stalled"
      ? `${name} · report stuck since ${relativeTime(item.since)}`
      : `${name} · report failed: ${item.failure_kind === "model_response_invalid" ? "the AI's answer couldn't be used" : "the AI service didn't respond"}`;
    return (
      <Row
        key={`s-${item.session_id}`}
        icon={<RefreshCw className="h-4 w-4 text-attention" />}
        title={title}
        meta={<p>{item.assessment.name} · {item.reference}</p>}
        action={
          <Button asChild size="sm" variant="outline">
            <Link to={resultsPath(item.assessment.id, item.session_id)} aria-label={`Open ${name}'s report`}>Open</Link>
          </Button>
        }
      />
    );
  }
  return (
    <Row
      key="look"
      icon={<ScanSearch className="h-4 w-4 text-muted-foreground" />}
      title={`${item.count} ${item.count === 1 ? "result needs" : "results need"} a human look · from the last 7 days`}
      meta={item.partial_count > 0 ? <p>{item.partial_count} have a skill that couldn't be evaluated</p> : null}
      action={
        <Button asChild size="sm" variant="outline">
          <a href="#results">Review</a>
        </Button>
      }
    />
  );
}

type ModuleProps<T> = { section?: Section<T>; loading: boolean; onRetry: () => void };

export function NeedsYou(props: ModuleProps<{ total: number; items: NeedsYouItem[] }>) {
  const s = props.section;
  return (
    <Module
      id="needs-you" title="Needs you" count={s?.status === "ok" ? s.data.total : undefined} {...props}
      empty={(d) => d.items.length === 0 ? (
        <div className="text-sm">
          <p>Nothing needs you right now.</p>
          <p className="text-muted-foreground">Failed interviews, stuck reports and results that need a human look will appear here.</p>
        </div>
      ) : null}
    >
      {(d) => <ul className="divide-y">{d.items.map(needsYouRow)}</ul>}
    </Module>
  );
}

export function LiveNow(props: ModuleProps<LiveItem[]>) {
  const s = props.section;
  const now = Date.now();
  return (
    <Module
      id="live" title="Live now" count={s?.status === "ok" ? s.data.filter((l) => !l.stale).length : undefined} {...props}
      empty={(d) => d.length === 0 ? <p className="text-sm text-muted-foreground">No one is interviewing right now.</p> : null}
    >
      {(d) => (
        <ul className="divide-y">
          {d.map((l) => {
            const name = nameOf(l.candidate_name);
            const elapsed = l.started_at ? Math.max(0, Math.floor((now - new Date(l.started_at).getTime()) / 60000)) : 0;
            const shown = Math.min(elapsed, l.time_limit_min);
            return (
              <Row
                key={l.session_id}
                icon={<Radio className="h-4 w-4 text-info" />}
                title={name}
                meta={
                  <>
                    <p className="truncate" title={l.assessment.name}>{l.assessment.name}</p>
                    {l.stale ? (
                      <p className="text-attention">Still marked live after {elapsed} min. It may have stopped.</p>
                    ) : (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 w-24 rounded-full bg-primary-soft" aria-hidden="true">
                          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(shown / l.time_limit_min) * 100}%` }} />
                        </div>
                        <span>{elapsed >= l.time_limit_min ? `${l.time_limit_min} of ${l.time_limit_min} min · finishing` : `${shown} of ${l.time_limit_min} min`}</span>
                      </div>
                    )}
                  </>
                }
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/assessments/${l.assessment.id}/sessions/${l.session_id}/monitor`} aria-label={`Monitor ${name}'s interview`}>
                      {l.stale ? "Open" : "Monitor"}
                    </Link>
                  </Button>
                }
              />
            );
          })}
        </ul>
      )}
    </Module>
  );
}

export function ResultsToRead(props: ModuleProps<{ total: number; items: ResultItem[] }>) {
  const s = props.section;
  const fresh = s?.status === "ok" ? s.data.items.filter((r) => r.new).length : 0;
  return (
    <Module
      id="results" title="Results to read" count={s?.status === "ok" ? s.data.total : undefined}
      extra={fresh > 0 ? `${fresh} new` : undefined} {...props}
      empty={(d) => d.items.length === 0 ? <p className="text-sm text-muted-foreground">No new results this week.</p> : null}
    >
      {(d) => (
        <ul className="divide-y">
          {d.items.map((r) => {
            const name = nameOf(r.candidate_name);
            return (
              <Row
                key={r.session_id}
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                title={
                  <>
                    {name} · {r.reference}
                    {r.new && " "}
                    {r.new && (
                      <Badge variant="secondary" className="ml-2 align-middle" title="New since your last visit on this device">
                        New
                      </Badge>
                    )}
                  </>
                }
                meta={
                  <div className="space-y-1.5">
                    <p>{r.assessment.name} · {relativeTime(r.generated_at)} · {duration(r.duration_seconds)}</p>
                    <EvidenceStrip statuses={r.skill_statuses} />
                  </div>
                }
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link to={resultsPath(r.assessment.id, r.session_id)} aria-label={`Read ${name}'s result`}>Read</Link>
                  </Button>
                }
              />
            );
          })}
        </ul>
      )}
    </Module>
  );
}
