import { Link } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  to?: string;
}

/**
 * The trail back out of a session, plus an explicit way to take one step.
 *
 * Every result screen hangs four levels below the navbar and the navbar has
 * no entry for any of them, so the trail names each step. But a trail answers
 * "where am I", and the question people actually have on these screens is
 * "how do I get back" — so the nearest parent also gets a real button, sized
 * and shaped like something you click. The 11px muted crumb above it is
 * technically the same link, which is exactly why it was easy to miss.
 *
 * The target is derived from the crumbs themselves, so no screen has to
 * declare its parent twice and the two can never disagree.
 */
export default function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  const parent = [...crumbs.slice(0, -1)].reverse().find((c) => c.to);

  return (
    <div className="flex flex-col gap-1.5">
      {parent && (
        <Link
          to={parent.to as string}
          className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to {parent.label}
        </Link>
      )}

      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-muted-foreground">
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {crumb.to && !isLast ? (
                  <Link
                    to={crumb.to}
                    className="rounded-sm hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={isLast ? "text-foreground" : undefined}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
                {!isLast && <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
