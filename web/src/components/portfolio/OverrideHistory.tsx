import { useEffect, useState } from "react";
import { portfoliosApi } from "@/services/portfolios";
import LevelBadge from "./LevelBadge";
import { Loader2 } from "lucide-react";
import { m } from "@/(paraglide)/messages.js";
import type { AssessorOverride } from "@/types";

interface OverrideHistoryProps {
  portfolioSkillId: number;
}

export default function OverrideHistory({ portfolioSkillId }: OverrideHistoryProps) {
  const [events, setEvents] = useState<AssessorOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    portfoliosApi
      .getOverrideHistory(portfolioSkillId)
      .then((res) => {
        if (!cancelled) setEvents(res.data.override_events);
        return;
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [portfolioSkillId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" /> {m.override_history.loading()}
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-muted-foreground py-2">{m.override_history.load_error()}</p>;
  }

  if (events.length === 0) return null;

  return (
    <div className="space-y-2 pt-2 border-t">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {m.override_history.title()}
      </span>
      <ul className="space-y-2">
        {events.map((ev) => (
          <li key={ev.id} className="flex items-start gap-3 text-sm">
            <div className="flex items-center gap-1.5 shrink-0">
              <LevelBadge level={ev.ai_level} size="sm" />
              <span className="text-muted-foreground">→</span>
              <LevelBadge level={ev.override_level} size="sm" />
            </div>
            <div className="min-w-0">
              {ev.assessor_notes && <p className="text-sm break-words">{ev.assessor_notes}</p>}
              <time className="text-xs text-muted-foreground">
                {ev.overridden_at ? new Date(ev.overridden_at).toLocaleString() : m.override_history.unknown_date()}
              </time>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
