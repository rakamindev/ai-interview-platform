import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalCount?: number;
  perPage?: number;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalCount,
  perPage = 20,
  className,
}: PaginationProps) {
  if (totalPages <= 1 && (!totalCount || totalCount <= perPage)) {
    return null;
  }

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push("ellipsis");
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) {
        pages.push("ellipsis");
      }
      pages.push(totalPages);
    }
    return pages;
  };

  const startItem = (currentPage - 1) * perPage + 1;
  const endItem = totalCount ? Math.min(currentPage * perPage, totalCount) : currentPage * perPage;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-sm text-muted-foreground",
        className
      )}
    >
      <div>
        {totalCount !== undefined && totalCount > 0 ? (
          <span>
            Showing <strong className="text-foreground font-medium">{startItem}</strong>–
            <strong className="text-foreground font-medium">{endItem}</strong> of{" "}
            <strong className="text-foreground font-medium">{totalCount}</strong> results
          </span>
        ) : (
          <span>
            Page <strong className="text-foreground font-medium">{currentPage}</strong> of{" "}
            <strong className="text-foreground font-medium">{totalPages}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="h-8 px-2.5 gap-1"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) =>
            p === "ellipsis" ? (
              <span key={`ellipsis-${idx}`} className="px-2 py-1 text-muted-foreground flex items-center">
                <MoreHorizontal className="h-4 w-4" />
              </span>
            ) : (
              <Button
                key={p}
                variant={p === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(p)}
                className={cn(
                  "h-8 w-8 p-0 text-xs font-medium",
                  p === currentPage ? "pointer-events-none" : ""
                )}
                aria-label={`Page ${p}`}
                aria-current={p === currentPage ? "page" : undefined}
              >
                {p}
              </Button>
            )
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="h-8 px-2.5 gap-1"
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
