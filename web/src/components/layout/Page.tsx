import { cn } from "@/lib/utils";

/**
 * How wide a screen is allowed to get.
 *
 * Every assessor screen used to be pinned to max-w-2xl inside a 1280px shell,
 * so on any real monitor the product was a narrow ribbon with empty gutters.
 * Widening everything is the wrong correction though: the evidence quotes and
 * the fit/gap narrative are prose, and prose stretched across 1900px stops
 * being readable — which would break the one thing this revamp exists to fix.
 *
 * The resolution: the *container* goes edge to edge, and the width is spent on
 * columns rather than on longer lines. A list becomes a grid of cards; the
 * monitor puts coverage beside the transcript; a paragraph keeps its own
 * measure inside a wide parent via max-w-prose. That way the window is full
 * and the prose is still readable — those were never actually in conflict, the
 * old layout just solved it by shrinking everything.
 *
 *   board    — scanned, not read. Lists, live monitor, comparison table.
 *   document — a mix. Portfolio cards carry quotes but are also compared.
 *   form     — filled in one field at a time. These stay narrow on purpose:
 *              a 1900px-wide text input makes people hunt for the next field.
 */
export type PageWidth = "board" | "document" | "form";

const WIDTH: Record<PageWidth, string> = {
  // Edge to edge. Nothing is held back from the window — the way the width
  // gets used is by laying content out in columns, not by stretching a single
  // column until its line length becomes unreadable.
  board: "max-w-none",
  document: "max-w-none",
  form: "max-w-2xl",
};

interface PageProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: PageWidth;
}

export default function Page({ width = "board", className, children, ...rest }: PageProps) {
  // Spread the remaining props so data-testid, aria-* and the like survive the
  // wrapper — dropping them silently is how test hooks disappear unnoticed.
  return (
    <div className={cn("mx-auto w-full", WIDTH[width], className)} {...rest}>
      {children}
    </div>
  );
}

/**
 * The header block every screen opens with: breadcrumb and title on the left,
 * actions on the right, wrapping to two rows on narrow viewports.
 */
export function PageHeader({
  children,
  actions,
  className,
}: {
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0 space-y-1.5">{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
