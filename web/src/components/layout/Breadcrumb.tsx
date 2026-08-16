import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  to?: string;
}

/**
 * The trail back out of a session.
 *
 * Every result screen — monitor, portfolio, transcript, fit/gap — hangs four
 * levels below the navbar, and the navbar has no entry for any of them. A
 * single back arrow told you there was somewhere to go but not where, so this
 * names each step instead.
 *
 * It is also where the candidate list stops calling itself "invite". The route
 * keeps that path so existing links survive, but nothing a person reads should
 * describe the review workspace as a page for sending invitations.
 */
export default function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
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
                <span className={isLast ? "text-foreground" : undefined} aria-current={isLast ? "page" : undefined}>
                  {crumb.label}
                </span>
              )}
              {!isLast && <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
