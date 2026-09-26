import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveNow, NeedsYou, ResultsToRead } from "@/components/home/DeskSections";
import { usePolling } from "@/hooks/usePolling";
import { homeApi } from "@/services/home";
import { buildLede } from "@/lib/lede";
import { readLastVisit, rememberVisit } from "@/lib/lastVisit";
import { clockTime, greeting, longDate, relativeTime } from "@/lib/time";
import type { HomeDesk } from "@/types/home";

// The review desk: what needs a person now.
export default function HomePage() {
  const [desk, setDesk] = useState<HomeDesk | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // Read once per page view. This visit then becomes the next one's "last visit".
  const [since] = useState(() => readLastVisit());
  useEffect(() => rememberVisit(new Date()), []);

  const load = useCallback(async () => {
    try {
      const res = await homeApi.get(since);
      setDesk(res.data);
      setUpdatedAt(new Date());
      setFailed(false);
    } catch {
      setFailed(true); // the last good data stays on screen
    } finally {
      setLoading(false);
    }
  }, [since]);

  useEffect(() => {
    document.title = "Home · Rakamin AI Interview";
    load();
  }, [load]);
  usePolling(load, 60_000, true);

  const now = new Date();
  const sectionProps = { loading, onRetry: load };

  if (!loading && !desk) {
    return (
      <div className="mx-auto max-w-md py-16 text-center space-y-3">
        <h1 className="text-xl font-semibold">We couldn't load your desk</h1>
        <p className="text-sm text-muted-foreground">Nothing is lost. Check your connection, then try again.</p>
        <Button onClick={load}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <span>{greeting(now)} · {longDate(now)}</span>
            {updatedAt && <span>· updated {clockTime(updatedAt)}</span>}
            {failed && desk && (
              <span className="text-attention">
                · couldn't refresh ·{" "}
                <button type="button" onClick={load} className="underline underline-offset-2">Try again</button>
              </span>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={load} aria-label="Refresh now">
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
          </p>
          <Brief desk={desk} />
        </div>
        <Button asChild>
          <Link to="/assessments/new"><Plus className="mr-1.5 h-4 w-4" /> New assessment</Link>
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <NeedsYou section={desk?.needs_you} {...sectionProps} />
          <ResultsToRead section={desk?.results} {...sectionProps} />
        </div>
        <div className="lg:col-span-4">
          <LiveNow section={desk?.live} {...sectionProps} />
        </div>
      </div>
    </div>
  );
}

function Brief({ desk }: { desk: HomeDesk | null }) {
  if (!desk) {
    return (
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-7 w-[28rem] max-w-full" />
        <Skeleton className="h-7 w-72 max-w-full" />
      </div>
    );
  }
  if (desk.summary.status === "error") {
    return <h1 className="text-2xl font-semibold">Your desk is partly unavailable. The lists below still show what we have.</h1>;
  }

  const summary = desk.summary.data;
  const results = desk.results.status === "ok" ? desk.results.data.total : 0;
  const lede = buildLede(summary, results);

  return (
    <div className="space-y-1">
      <h1 className="max-w-3xl text-2xl font-semibold leading-snug">
        {lede.sentences.map((sentence, i) => (
          <span key={i}>
            {i > 0 && " "}
            {sentence.map((part, j) =>
              part.href ? (
                <a key={j} href={part.href} className="text-primary underline underline-offset-4 hover:text-primary-strong">
                  {part.text}
                </a>
              ) : (
                <span key={j}>{part.text}</span>
              )
            )}
          </span>
        ))}
      </h1>
      {lede.calm && summary.last_result_at && (
        <p className="text-base text-muted-foreground">The last result came in {relativeTime(summary.last_result_at)}.</p>
      )}
    </div>
  );
}
