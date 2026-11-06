import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import LevelBadge from "./LevelBadge";
import { History } from "lucide-react";
import { formatWib } from "@/utils/overrides";
import type { OverrideEvent } from "@/types";

const VISIBLE_BY_DEFAULT = 3;

interface OverrideHistoryProps {
  /** Newest first, as returned by the API. */
  events: OverrideEvent[];
}

/**
 * Every human correction of an AI level: who, when, from -> to, and why.
 * Assessors are shown by id because the JWT has no name and there is no user lookup.
 */
export default function OverrideHistory({ events }: OverrideHistoryProps) {
  const titleId = useId();
  const [showAll, setShowAll] = useState(false);

  if (events.length === 0) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <History className="h-3.5 w-3.5 shrink-0" aria-hidden />
        No human corrections yet. The level above is the AI&apos;s rating.
      </p>
    );
  }

  const visible = showAll ? events : events.slice(0, VISIBLE_BY_DEFAULT);
  const hidden = events.length - visible.length;

  return (
    <section className="space-y-2">
      <h3 id={titleId} className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <History className="h-3.5 w-3.5" aria-hidden />
        Correction history ({events.length})
      </h3>

      <ol aria-labelledby={titleId} className="space-y-2 border-l pl-3">
        {visible.map((e) => (
          <li key={e.id} className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <LevelBadge level={e.previous_level} size="sm" />
              <span className="text-muted-foreground" aria-hidden>→</span>
              <span className="sr-only">changed to</span>
              <LevelBadge level={e.new_level} size="sm" />
              {e.new_level === e.ai_level && (
                <span className="text-xs text-muted-foreground">(back to AI rating)</span>
              )}
              {e.legacy && (
                <span className="text-[11px] rounded bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5">
                  Before reasons were required
                </span>
              )}
            </div>
            {e.reason ? (
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">{e.reason}</p>
            ) : (
              <p className="text-sm italic text-muted-foreground">No reason recorded.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Assessor #{e.actor_id} · <time dateTime={e.created_at}>{formatWib(e.created_at)}</time>
            </p>
          </li>
        ))}
      </ol>

      {hidden > 0 && (
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setShowAll(true)}>
          Show all {events.length}
        </Button>
      )}
    </section>
  );
}
