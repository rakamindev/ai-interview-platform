import type { ReactNode } from "react";
import { m } from "motion/react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export interface RowListItem {
  key: string | number;
  to: string;
  title: ReactNode;
  meta?: ReactNode;
}

/** Index lists (assessments, vacancies): one bordered list, one row per record, the whole row is the link. */
export default function RowList({ items, label }: { items: RowListItem[]; label: string }) {
  return (
    <ul aria-label={label} className="divide-y rounded-lg border bg-card">
      {items.map((item, i) => (
        <m.li
          key={item.key}
          // Short stagger on first load: rows read as arriving data, top to bottom. Capped so long lists stay fast.
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i, 8) * 0.03 }}
        >
          <Link
            to={item.to}
            className="group flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition-colors first:rounded-t-lg hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <div className="min-w-0">
              <p className="font-medium text-sm break-words">{item.title}</p>
              {item.meta && <div className="mt-0.5 text-xs text-muted-foreground">{item.meta}</div>}
            </div>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </m.li>
      ))}
    </ul>
  );
}

export function RowListSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading list" className="divide-y rounded-lg border motion-safe:animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex min-h-14 items-center justify-between px-4 py-3">
          <div className="space-y-2">
            <div className="h-4 w-48 rounded bg-muted" />
            <div className="h-3 w-28 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
