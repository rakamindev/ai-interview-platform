import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  loading?: boolean;
  ariaLabel?: string;
}

type PaginationItem = number | "ellipsis-start" | "ellipsis-end";

function paginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) return [1, 2, 3, "ellipsis-end", totalPages];
  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis-start", totalPages - 2, totalPages - 1, totalPages];
  }

  return [
    1,
    "ellipsis-start",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis-end",
    totalPages,
  ];
}

export function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  disabled = false,
  loading = false,
  ariaLabel = "Pagination",
}: PaginationProps) {
  const formattedCount = new Intl.NumberFormat().format(totalCount);
  const firstRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastRecord = Math.min(currentPage * pageSize, totalCount);
  const formattedFirstRecord = new Intl.NumberFormat().format(firstRecord);
  const formattedLastRecord = new Intl.NumberFormat().format(lastRecord);
  const controlsDisabled = disabled || loading;
  const pages = paginationItems(currentPage, totalPages);

  if (totalPages <= 1) {
    return (
      <div className="flex justify-center rounded-lg border bg-muted/30 px-4 py-3 sm:justify-start">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Showing <span className="font-medium text-foreground">{formattedFirstRecord}</span>
          {"–"}
          <span className="font-medium text-foreground">{formattedLastRecord}</span> of{" "}
          <span className="font-medium text-foreground">{formattedCount}</span>{" "}
          {totalCount === 1 ? "record" : "records"}
        </p>
      </div>
    );
  }

  return (
    <nav
      aria-label={ariaLabel}
      className="flex flex-wrap items-center justify-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 sm:justify-between sm:px-4"
    >
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{formattedFirstRecord}</span>
        {"–"}
        <span className="font-medium text-foreground">{formattedLastRecord}</span> of{" "}
        <span className="font-medium text-foreground">{formattedCount}</span>{" "}
        {totalCount === 1 ? "record" : "records"}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="border border-transparent px-2 hover:border-border hover:bg-background sm:px-2.5"
          disabled={controlsDisabled || currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Go to previous page"
        >
          <ChevronLeft aria-hidden="true" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        <div className="flex items-center gap-1" aria-live="polite" aria-atomic="true">
          {pages.map((item) =>
            typeof item === "number" ? (
              <Button
                key={item}
                type="button"
                variant={item === currentPage ? "default" : "ghost"}
                size="icon"
                className={
                  item === currentPage
                    ? "h-8 w-8 shadow-sm"
                    : "h-8 w-8 border border-transparent text-muted-foreground hover:border-border hover:bg-background hover:text-foreground"
                }
                disabled={controlsDisabled || item === currentPage}
                onClick={() => onPageChange(item)}
                aria-label={item === currentPage ? `Current page, page ${item}` : `Go to page ${item}`}
                aria-current={item === currentPage ? "page" : undefined}
              >
                {item}
              </Button>
            ) : (
              <span
                key={item}
                className="flex h-8 w-6 items-center justify-center text-sm text-muted-foreground"
                aria-hidden="true"
              >
                …
              </span>
            )
          )}
          <span className="sr-only">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="border border-transparent px-2 hover:border-border hover:bg-background sm:px-2.5"
          disabled={controlsDisabled || currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Go to next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
