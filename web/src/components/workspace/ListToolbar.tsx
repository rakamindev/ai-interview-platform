import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface ListFilterOption {
  value: string;
  label: string;
}

interface ListToolbarProps {
  search: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  filterLabel?: string;
  filterValue?: string;
  filterOptions?: ListFilterOption[];
  onFilterChange?: (value: string) => void;
  resultCount: number;
}

export default function ListToolbar({
  search,
  searchPlaceholder,
  onSearchChange,
  filterLabel,
  filterValue,
  filterOptions = [],
  onFilterChange,
  resultCount,
}: ListToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-11 pl-9 pr-10"
          />
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2"
              aria-label="Clear search"
              onClick={() => onSearchChange("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {filterLabel && filterValue !== undefined && onFilterChange && filterOptions.length > 0 && (
          <Select value={filterValue} onValueChange={onFilterChange}>
            <SelectTrigger className="h-11 w-full sm:w-48" aria-label={filterLabel}>
              <SelectValue placeholder={filterLabel} />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <p className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
        {resultCount} result{resultCount === 1 ? "" : "s"} on this page
      </p>
    </div>
  );
}
