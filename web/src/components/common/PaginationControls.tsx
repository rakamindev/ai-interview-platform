import { Button } from "@/components/ui/button";
import type { PaginationMeta } from "@/types";

interface PaginationControlsProps {
  meta: PaginationMeta | null;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

/**
 * Prev/Next pagination controls driven by the API's PaginationMeta.
 * Renders nothing when there is only a single page (or no data yet).
 */
export default function PaginationControls({
  meta,
  onPageChange,
  disabled = false,
}: PaginationControlsProps) {
  if (!meta || meta.total_pages <= 1) return null;

  const { current_page, total_pages, total_count } = meta;
  const prevDisabled = disabled || current_page <= 1;
  const nextDisabled = disabled || current_page >= total_pages;

  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-xs text-muted-foreground">
        Page {current_page} of {total_pages} · {total_count} items
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={prevDisabled}
          onClick={() => onPageChange(current_page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={nextDisabled}
          onClick={() => onPageChange(current_page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
