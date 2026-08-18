import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SESSION_STATUS_FILTERS, type SessionListStatus } from "@/utils/listQuery";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

export function ListControls({
  search,
  onSearchChange,
  searchPlaceholder = "Search by name",
  status,
  onStatusChange,
  showStatus = true,
  includeNoneStatus = false,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  status?: SessionListStatus;
  onStatusChange?: (value: SessionListStatus) => void;
  showStatus?: boolean;
  includeNoneStatus?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 justify-between">
      <div className="relative w-3/5 md:w-[15.35rem] max-w-full">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground " />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-8 h-8 text-xs md:text-sm"
        />
      </div>
      {showStatus && status != null && onStatusChange && (
        <Select value={status} onValueChange={(v) => onStatusChange(v as SessionListStatus)}>
          <SelectTrigger className="h-8 w-1/3 md:w-1/6 text-xs md:text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SESSION_STATUS_FILTERS.filter(
              (opt) => includeNoneStatus || opt.value !== "none"
            ).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export function ListScroll({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("max-h-[60vh] overflow-y-auto", className)}>
      {children}
    </div>
  );
}
