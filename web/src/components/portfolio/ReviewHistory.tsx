import { useCallback, useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { levelText } from "@/components/portfolio/reviewText";
import { portfoliosApi } from "@/services/portfolios";
import { formatUtc } from "@/utils/datetime";
import type { OverrideEvent, PortfolioSkill } from "@/types";

function summary(event: OverrideEvent): string {
  if (event.action === "set") return `Assessor override, from ${levelText(event.from_level)} to ${levelText(event.to_level)}`;
  if (event.action === "revert") return `Override undone, back to ${levelText(event.to_level)}`;
  return `AI rating confirmed at ${levelText(event.to_level)}`;
}

// The append-only review trail of one skill, newest first, loaded on open.
export default function ReviewHistory({ skill }: { skill: PortfolioSkill }) {
  const [events, setEvents] = useState<OverrideEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await portfoliosApi.getOverrideEvents(skill.id);
      setEvents(res.data.events);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [skill.id]);

  return (
    <Dialog onOpenChange={(open) => { if (open) load(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <History aria-hidden="true" />
          Review history <span className="sr-only">for {skill.skill_label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 [overflow-wrap:anywhere]">{`Review history: ${skill.skill_label}`}</DialogTitle>
          <DialogDescription>Newest first. Times are in UTC.</DialogDescription>
        </DialogHeader>
        {loading && (
          <div aria-busy="true" aria-label="Loading history" className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}
        {!loading && failed && (
          <ErrorState title="Could not load the history" onRetry={load} className="p-4" />
        )}
        {!loading && !failed && events?.length === 0 && (
          <p className="text-sm text-muted-foreground">No assessor review yet.</p>
        )}
        {!loading && !failed && events && events.length > 0 && (
          <ol className="space-y-3">
            {events.map((event) => (
              <li key={event.id} className="space-y-1 rounded-md border p-3 text-sm">
                <p className="font-medium">{summary(event)}</p>
                <p className="text-xs text-muted-foreground">{`Assessor #${event.actor_id}, ${formatUtc(event.created_at)}`}</p>
                {event.notes ? (
                  <blockquote className="whitespace-pre-line border-l-2 pl-2 [overflow-wrap:anywhere]">{event.notes}</blockquote>
                ) : (
                  <p className="text-xs text-muted-foreground">No note</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
