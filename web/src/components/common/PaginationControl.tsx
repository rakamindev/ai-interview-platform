import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginationMeta } from "@/types";

interface PaginationControlProps {
  meta?: PaginationMeta;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function PaginationControl({ meta, onPageChange, disabled }: PaginationControlProps) {
  if (!meta || meta.total_pages <= 1) return null;

  const { current_page, total_pages, total_count } = meta;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 px-1 text-xs text-muted-foreground">
      <span>
        Total <strong className="font-semibold text-foreground">{total_count}</strong> item{total_count !== 1 ? "s" : ""}
      </span>
      <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
        <span>
          Page <strong className="font-semibold text-foreground">{current_page}</strong> of{" "}
          <strong className="font-semibold text-foreground">{total_pages}</strong>
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={current_page <= 1 || disabled}
            onClick={() => onPageChange(current_page - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={current_page >= total_pages || disabled}
            onClick={() => onPageChange(current_page + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
