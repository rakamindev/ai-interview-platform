import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 0) return null;

  return (
    <div className="flex items-center justify-between pt-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
      </Button>
      <span className="text-xs text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
      </Button>
    </div>
  );
}
