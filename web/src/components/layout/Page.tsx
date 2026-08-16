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
 * So width follows what the screen is *for*:
 *
 *   board    — scanned, not read. Lists, the live monitor, the comparison
 *              table. These earn the whole window.
 *   document — a mix. Portfolio cards carry quotes but are also compared
 *              against each other.
 *   form     — filled in, one field at a time. Wide forms make people hunt
 *              for the next input, so these stay deliberately narrow.
 *
 * Prose *inside* a board still gets its own measure via max-w-prose; the tier
 * governs the container, not every descendant.
 */
export type PageWidth = "board" | "document" | "form";

const WIDTH: Record<PageWidth, string> = {
  board: "max-w-[1400px]",
  document: "max-w-5xl",
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
