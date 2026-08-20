import { Button } from "@/components/ui/button";
import type { PaginationMeta } from "@/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  meta: PaginationMeta | null;
  onPageChange: (page: number) => void;
}

export default function PaginationControls({ meta, onPageChange }: Props) {
  if (!meta || meta.total_pages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-muted-foreground">
        Showing page {meta.current_page} of {meta.total_pages} ({meta.total_count} total)
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={meta.current_page === 1}
          onClick={() => onPageChange(meta.current_page - 1)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.current_page === meta.total_pages}
          onClick={() => onPageChange(meta.current_page + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
