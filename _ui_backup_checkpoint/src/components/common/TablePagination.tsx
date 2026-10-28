import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export default function TablePagination({
  currentPage,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  if (totalItems === 0) return null;

  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200/80 text-xs text-muted-foreground select-none">
      {/* Items count & Per-page selector */}
      <div className="flex items-center gap-3">
        <span>
          Showing <strong className="text-slate-800 font-medium">{startItem}</strong> to{" "}
          <strong className="text-slate-800 font-medium">{endItem}</strong> of{" "}
          <strong className="text-slate-800 font-medium">{totalItems}</strong> entries
        </span>

        <div className="flex items-center gap-1.5 ml-1">
          <span className="hidden sm:inline text-slate-500">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 font-medium shadow-2xs focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Page Navigation Controls */}
      <div className="flex items-center gap-1 self-end sm:self-auto">
        {/* First Page */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900 border-slate-200"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="First Page"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>

        {/* Previous Page */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900 border-slate-200"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-3.5 w-3.5 mr-0.5" /> Prev
        </Button>

        {/* Page Number Buttons */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) =>
            p === "..." ? (
              <span key={`dots-${idx}`} className="px-1.5 text-slate-400">
                ...
              </span>
            ) : (
              <Button
                key={p}
                variant={currentPage === p ? "default" : "outline"}
                size="sm"
                className={`h-8 w-8 p-0 text-xs font-medium ${
                  currentPage === p
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "text-slate-700 hover:bg-slate-50 border-slate-200"
                }`}
                onClick={() => onPageChange(Number(p))}
              >
                {p}
              </Button>
            )
          )}
        </div>

        {/* Next Page */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900 border-slate-200"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
        </Button>

        {/* Last Page */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900 border-slate-200"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="Last Page"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

