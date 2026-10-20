import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaginationMeta } from "@/types";

interface PaginationControlsProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}

export default function PaginationControls({ meta, onPageChange }: PaginationControlsProps) {
  if (meta.total_pages <= 1) return null;

  const pages = Array.from({ length: meta.total_pages }, (_, index) => index + 1).filter(
    (page) => page === 1 || page === meta.total_pages || Math.abs(page - meta.current_page) <= 1
  );

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
      <p className="text-xs text-muted-foreground">
        Page {meta.current_page} of {meta.total_pages} · {meta.total_count} result{meta.total_count === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10"
          aria-label="Previous page"
          disabled={meta.current_page <= 1}
          onClick={() => onPageChange(meta.current_page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((page, index) => {
          const previousPage = pages[index - 1];
          const showGap = previousPage !== undefined && page - previousPage > 1;
          return (
            <span key={page} className="flex items-center gap-1">
              {showGap && <span className="px-1 text-muted-foreground">…</span>}
              <Button
                variant={page === meta.current_page ? "default" : "outline"}
                className="h-10 min-w-10 px-3"
                aria-label={`Page ${page}`}
                aria-current={page === meta.current_page ? "page" : undefined}
                onClick={() => onPageChange(page)}
              >
                {page}
              </Button>
            </span>
          );
        })}
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10"
          aria-label="Next page"
          disabled={meta.current_page >= meta.total_pages}
          onClick={() => onPageChange(meta.current_page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
