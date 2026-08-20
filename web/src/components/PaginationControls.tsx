import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaginationMeta } from "@/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  meta: PaginationMeta | null;
  onPageChange: (page: number) => void;
  limit?: number;
  onLimitChange?: (limit: number) => void;
}

export default function PaginationControls({ meta, onPageChange, limit = 10, onLimitChange }: Props) {
  if (!meta) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
      {/* Mobile: 3 rows centered. Desktop: Left side limit, Right side pagination */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
        {onLimitChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <Select
              value={limit.toString()}
              onValueChange={(val) => {
                onLimitChange(Number(val));
                onPageChange(1); // Reset to first page when limit changes
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={limit} />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((pageSize) => (
                  <SelectItem key={pageSize} value={pageSize.toString()}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Middle row on mobile, inline on desktop */}
        <p className="text-sm text-muted-foreground text-center">
          Showing page {meta.current_page} of {meta.total_pages} ({meta.total_count} total)
        </p>
      </div>

      <div className="flex items-center gap-2 justify-center sm:justify-end w-full sm:w-auto">
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
            disabled={meta.current_page === meta.total_pages || meta.total_pages === 0}
            onClick={() => onPageChange(meta.current_page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
